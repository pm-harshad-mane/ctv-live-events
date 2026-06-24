import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LiveEvent,
  LiveState,
  MatchContext,
  MatchIdentity,
  ProviderMode,
  PublicConfig,
  TrackerArchive,
  TrackerArchiveSummary,
  TrackerHistoryPoint,
  UpcomingEvent
} from "../../shared/schemas/live";
import {
  ApiError,
  discoverLiveEvents,
  fetchConfig,
  fetchTrackerArchive,
  fetchTrackerArchives,
  fetchUpcomingEvents,
  refreshLiveStates,
  saveTrackerArchive as persistTrackerArchive,
  switchActiveModel
} from "../lib/api";

type Filters = {
  region: string;
  sport: string;
};

type LiveMatchDetail = {
  matchId: string;
  context: MatchContext;
  liveState: LiveState;
};

const TRACKER_IDLE_MESSAGE = "Choose a live match to track.";
const ARCHIVE_IDLE_MESSAGE = "Choose a completed tracked event to review.";
const TRACKER_TIMEOUT_BUFFER_MS = 15000;
const TERMINAL_MATCH_STATUSES = new Set(["completed", "cancelled", "postponed"]);

const normalizeScheduledStart = (value: string | undefined): string =>
  value ? new Date(value).toISOString() : "";

const getLiveEventSemanticKey = (event: LiveEvent): string => {
  const context = event.context;
  if (!context) {
    return event.match_id;
  }

  const participantKey = context.participants
    .map((participant) => participant.name.trim().toLowerCase())
    .sort()
    .join("|");

  return [
    context.match.sport,
    normalizeScheduledStart(context.match.scheduled_start_time),
    participantKey
  ].join("::");
};

const buildIdentity = (event: LiveEvent): MatchIdentity => ({
  match_id: event.match_id,
  sport: event.context?.match.sport ?? "unknown",
  tournament_name: event.context?.match.tournament_name ?? "Unknown",
  scheduled_start_time:
    event.context?.match.scheduled_start_time ?? new Date().toISOString(),
  participants: getIdentityParticipants(event)
});

const hasTwoParticipants = (
  participants: Array<{ participant_id: string; name: string }>
): boolean => participants.length >= 2;

const getIdentityParticipants = (event: LiveEvent): MatchIdentity["participants"] => {
  const contextParticipants =
    event.context?.participants.map((participant) => ({
      participant_id: participant.participant_id,
      name: participant.name,
      short_name: participant.short_name
    })) ?? [];

  if (hasTwoParticipants(contextParticipants)) {
    return contextParticipants;
  }

  const matchName = event.context?.match.match_name ?? "";
  const nameParts = matchName
    .split(/\s+vs\.?\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const scoreParticipants = event.live_state.score.participant_scores;

  if (nameParts.length >= 2 && scoreParticipants.length >= 2) {
    return scoreParticipants.slice(0, 2).map((participantScore, index) => ({
      participant_id: participantScore.participant_id,
      name: nameParts[index] ?? participantScore.participant_id,
      short_name:
        participantScore.participant_id.length <= 5
          ? participantScore.participant_id
          : null
    }));
  }

  return contextParticipants;
};

const mergeDiscovery = (
  currentEvents: LiveEvent[],
  incomingEvents: LiveEvent[]
): LiveEvent[] => {
  const byId = new Map(currentEvents.map((event) => [event.match_id, event]));
  const bySemanticKey = new Map(
    currentEvents.map((event) => [getLiveEventSemanticKey(event), event])
  );
  for (const incoming of incomingEvents) {
    const existing =
      byId.get(incoming.match_id) ??
      bySemanticKey.get(getLiveEventSemanticKey(incoming));
    const acceptedState =
      existing && !shouldAcceptLiveStateUpdate(existing.live_state, incoming.live_state)
        ? existing.live_state
        : existing
          ? preserveLiveStateSources(existing.live_state, incoming.live_state)
          : incoming.live_state;
    const acceptedContext =
      incoming.context_status === "unchanged" && existing?.context
        ? existing.context
        : existing?.context &&
            existing.context.participants.length >= 2 &&
            (!incoming.context || incoming.context.participants.length < 2)
          ? existing.context
          : incoming.context;

    byId.set(incoming.match_id, {
      ...(existing ?? incoming),
      ...incoming,
      match_id: existing?.match_id ?? incoming.match_id,
      context: acceptedContext,
      live_state: acceptedState,
      freshness: existing
        ? {
            ...incoming.freshness,
            state_generated_at: acceptedState.freshness.generated_at,
            state_age_seconds: acceptedState.freshness.age_seconds
          }
        : incoming.freshness
    });
  }
  return Array.from(byId.values());
};

const preserveCurrentSlateOnWeakDiscovery = (
  currentEvents: LiveEvent[],
  incomingEvents: LiveEvent[]
): boolean => currentEvents.length > 0 && incomingEvents.length === 0;

const mergeStates = (
  currentEvents: LiveEvent[],
  nextStates: Map<string, LiveEvent["live_state"]>
): LiveEvent[] =>
  currentEvents.map((event) => {
    const nextState = nextStates.get(event.match_id);
    if (!nextState) {
      return event;
    }

    const acceptedState = shouldAcceptLiveStateUpdate(
      event.live_state,
      nextState
    )
      ? preserveLiveStateSources(event.live_state, nextState)
      : event.live_state;
    return {
      ...event,
      live_state: acceptedState,
      freshness: {
        ...event.freshness,
        state_generated_at: acceptedState.freshness.generated_at,
        state_age_seconds: acceptedState.freshness.age_seconds
      }
    };
  });

const INVALID_SCORE_TOKENS = new Set(["null", "undefined", "nan"]);
const GENERIC_LIVE_HEADLINES = new Set([
  "match in progress",
  "match status unverified"
]);

const hasInvalidScoreData = (state: LiveState): boolean => {
  const display = state.score.display.trim().toLowerCase();
  if (INVALID_SCORE_TOKENS.has(display)) {
    return true;
  }

  return state.score.participant_scores.some((participantScore) =>
    INVALID_SCORE_TOKENS.has(
      participantScore.display_score.trim().toLowerCase()
    )
  );
};

const getAggregateNumericScore = (state: LiveState): number =>
  state.score.participant_scores.reduce(
    (total, participantScore) => total + participantScore.numeric_score,
    0
  );

const getSafeWatchability = (state: LiveState) =>
  state.watchability ?? {
    current_score: 0,
    tension_score: 0,
    scoring_imminence_score: 0,
    swing_potential_score: 0,
    state_clarity_score: 0,
    evidence_strength_score: 0
  };

const isGenericFallbackState = (state: LiveState): boolean => {
  const headline = state.summary.headline.trim().toLowerCase();
  const shortByte = state.summary.short_byte.trim().toLowerCase();
  const watchability = getSafeWatchability(state);

  return (
    GENERIC_LIVE_HEADLINES.has(headline) ||
    GENERIC_LIVE_HEADLINES.has(shortByte) ||
    (watchability.current_score === 50 &&
      watchability.tension_score === 50 &&
      watchability.scoring_imminence_score === 50 &&
      watchability.swing_potential_score === 50 &&
      watchability.state_clarity_score === 50 &&
      watchability.evidence_strength_score === 50)
  );
};

const looksLikeMatchRestartFallback = (
  currentState: LiveState,
  nextState: LiveState
): boolean => {
  const currentAggregateScore = getAggregateNumericScore(currentState);
  const nextAggregateScore = getAggregateNumericScore(nextState);

  return (
    currentState.clock.elapsed_seconds > 0 &&
    nextState.clock.elapsed_seconds === 0 &&
    nextState.clock.remaining_seconds >= 3600 &&
    currentAggregateScore > 0 &&
    nextAggregateScore === 0
  );
};

const shouldAcceptLiveStateUpdate = (
  currentState: LiveState,
  nextState: LiveState
): boolean => {
  if (hasInvalidScoreData(nextState)) {
    return false;
  }

  if (
    nextState.match_status === "unverified" &&
    currentState.verification.confidence > nextState.verification.confidence
  ) {
    return false;
  }

  const currentAggregateScore = getAggregateNumericScore(currentState);
  const nextAggregateScore = getAggregateNumericScore(nextState);

  if (
    currentAggregateScore > 0 &&
    nextAggregateScore === 0 &&
    isGenericFallbackState(nextState)
  ) {
    return false;
  }

  if (looksLikeMatchRestartFallback(currentState, nextState)) {
    return false;
  }

  return true;
};

const preserveLiveStateSources = (
  currentState: LiveState,
  nextState: LiveState
): LiveState =>
  (nextState.sources?.length ?? 0) > 0 || (currentState.sources?.length ?? 0) === 0
    ? nextState
    : {
        ...nextState,
        sources: currentState.sources ?? []
      };

const isClearlyWeakLiveSnapshot = (state: LiveState): boolean => {
  const watchability = getSafeWatchability(state);
  const zeroOrGenericWatchability =
    watchability.current_score <= 50 &&
    watchability.tension_score <= 50 &&
    watchability.scoring_imminence_score <= 50 &&
    watchability.swing_potential_score <= 50 &&
    watchability.state_clarity_score <= 50 &&
    watchability.evidence_strength_score <= 50;

  const zeroedCoreScores =
    state.excitement.aggregate_score === 0 &&
    state.criticality.score === 0 &&
    state.competitive_balance.score === 0 &&
    state.momentum.score === 0;

  const preKickoffLikeClock =
    state.clock.elapsed_seconds === 0 &&
    state.clock.display === "00:00" &&
    state.clock.remaining_seconds >= 3600;

  const noScoringProgress =
    getAggregateNumericScore(state) === 0 && state.score.score_differential === 0;

  return (
    hasInvalidScoreData(state) ||
    state.match_status === "unverified" ||
    (preKickoffLikeClock && noScoringProgress && zeroOrGenericWatchability) ||
    (isGenericFallbackState(state) && noScoringProgress) ||
    zeroedCoreScores
  );
};

const getLiveEventStrength = (event: LiveEvent): number => {
  const state = event.live_state;
  const watchability = getSafeWatchability(state);

  return (
    state.verification.confidence * 1000 +
    getAggregateNumericScore(state) * 100 +
    watchability.current_score * 10 +
    state.excitement.aggregate_score * 5 +
    state.clock.elapsed_seconds / 60
  );
};

const getTrackableEvents = (events: LiveEvent[]): LiveEvent[] => {
  const bestBySemanticKey = new Map<string, LiveEvent>();

  for (const event of events) {
    if (!event.context || event.context.participants.length < 2) {
      continue;
    }

    if (isClearlyWeakLiveSnapshot(event.live_state)) {
      continue;
    }

    const semanticKey = getLiveEventSemanticKey(event);
    const existing = bestBySemanticKey.get(semanticKey);

    if (!existing || getLiveEventStrength(event) > getLiveEventStrength(existing)) {
      bestBySemanticKey.set(semanticKey, event);
    }
  }

  return Array.from(bestBySemanticKey.values());
};

const appendTrackerHistory = (
  currentHistory: TrackerHistoryPoint[],
  nextState: LiveState
): TrackerHistoryPoint[] => {
  const capturedAt = nextState.freshness.generated_at;
  if (currentHistory.at(-1)?.capturedAt === capturedAt) {
    return currentHistory;
  }

  const nextHistory = [...currentHistory, { capturedAt, liveState: nextState }];
  return nextHistory.slice(-40);
};

const filterUiWarnings = (warnings: string[]): string[] =>
  warnings.filter(
    (warning) =>
      !warning.startsWith(
        "Gemini response did not include Google Search grounding metadata"
      ) &&
      !warning.startsWith("Gemini finish reason:") &&
      !warning.startsWith("Gemini response preview:")
  );

export const useLiveEvents = () => {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [staleMatchIds, setStaleMatchIds] = useState<string[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [selectedLiveMatchId, setSelectedLiveMatchId] = useState<string | null>(
    null
  );
  const [selectedUpcomingMatchId, setSelectedUpcomingMatchId] = useState<
    string | null
  >(null);
  const [selectedLiveMatchDetail, setSelectedLiveMatchDetail] =
    useState<LiveMatchDetail | null>(null);
  const [selectedUpcomingMatchDetail, setSelectedUpcomingMatchDetail] =
    useState<UpcomingEvent | null>(null);
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [upcomingDays, setUpcomingDays] = useState(7);
  const [filters, setFilters] = useState<Filters>({
    region: "north-america",
    sport: "soccer"
  });
  const [liveWarnings, setLiveWarnings] = useState<string[]>([]);
  const [upcomingWarnings, setUpcomingWarnings] = useState<string[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [hasLoadedLiveOnce, setHasLoadedLiveOnce] = useState(false);
  const [hasLoadedUpcomingOnce, setHasLoadedUpcomingOnce] = useState(false);
  const [periodicUpdatesEnabled, setPeriodicUpdatesEnabled] = useState(false);
  const [liveFetchTrigger, setLiveFetchTrigger] = useState(0);
  const [upcomingFetchTrigger, setUpcomingFetchTrigger] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Loading live sports intelligence..."
  );
  const [upcomingStatusMessage, setUpcomingStatusMessage] = useState(
    "Loading upcoming matches..."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serviceDisabled, setServiceDisabled] = useState(false);
  const [stateCountdown, setStateCountdown] = useState(60);
  const [discoveryCountdown, setDiscoveryCountdown] = useState(300);
  const [trackedLiveMatchId, setTrackedLiveMatchId] = useState<string | null>(
    null
  );
  const [trackedLiveSnapshot, setTrackedLiveSnapshot] = useState<LiveEvent | null>(
    null
  );
  const [trackerHistory, setTrackerHistory] = useState<TrackerHistoryPoint[]>(
    []
  );
  const [trackerPollingIntervalSeconds, setTrackerPollingIntervalSeconds] =
    useState(60);
  const [trackerUpdatesEnabled, setTrackerUpdatesEnabled] = useState(false);
  const [trackerCountdown, setTrackerCountdown] = useState(60);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerStatusMessage, setTrackerStatusMessage] =
    useState(TRACKER_IDLE_MESSAGE);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [trackerArchives, setTrackerArchives] = useState<TrackerArchiveSummary[]>(
    []
  );
  const [selectedTrackerArchiveId, setSelectedTrackerArchiveId] = useState<
    string | null
  >(null);
  const [selectedTrackerArchive, setSelectedTrackerArchive] =
    useState<TrackerArchive | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveStatusMessage, setArchiveStatusMessage] = useState(
    ARCHIVE_IDLE_MESSAGE
  );
  const [archiveReloadToken, setArchiveReloadToken] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const liveControllerRef = useRef<AbortController | null>(null);
  const upcomingControllerRef = useRef<AbortController | null>(null);
  const configControllerRef = useRef<AbortController | null>(null);
  const detailControllerRef = useRef<AbortController | null>(null);
  const archiveControllerRef = useRef<AbortController | null>(null);
  const archiveDetailControllerRef = useRef<AbortController | null>(null);
  const lastArchivedTrackerPointRef = useRef<string | null>(null);

  const eventIdentities = useMemo(() => events.map(buildIdentity), [events]);
  const manualFetchMode = config ? !config.use_mock_data : false;
  const trackableEvents = useMemo(() => getTrackableEvents(events), [events]);
  const trackedLiveEvent = trackedLiveSnapshot;
  const trackerLastUpdatedAt = trackerHistory.at(-1)?.capturedAt ?? null;
  const trackerRequestTimeoutMs = config
    ? config.active_model_request_timeout_ms + TRACKER_TIMEOUT_BUFFER_MS
    : 60000;

  const resetLoadedState = (nextConfig: PublicConfig) => {
    liveControllerRef.current?.abort();
    upcomingControllerRef.current?.abort();
    detailControllerRef.current?.abort();
    setEvents([]);
    setUpcomingEvents([]);
    setStaleMatchIds([]);
    setLiveWarnings([]);
    setUpcomingWarnings([]);
    setSelectedLiveMatchId(null);
    setSelectedUpcomingMatchId(null);
    setSelectedLiveMatchDetail(null);
    setSelectedUpcomingMatchDetail(null);
    setTrackedLiveMatchId(null);
    setTrackedLiveSnapshot(null);
    setTrackerHistory([]);
    setTrackerUpdatesEnabled(false);
    setTrackerPollingIntervalSeconds(60);
    setTrackerCountdown(60);
    setTrackerLoading(false);
    setTrackerError(null);
    setTrackerStatusMessage(TRACKER_IDLE_MESSAGE);
    setSelectedTrackerArchiveId(null);
    setSelectedTrackerArchive(null);
    setArchiveLoading(false);
    setArchiveError(null);
    setArchiveStatusMessage(ARCHIVE_IDLE_MESSAGE);
    setDetailStatus("idle");
    setDetailError(null);
    setHasLoadedLiveOnce(false);
    setHasLoadedUpcomingOnce(false);
    setLiveFetchTrigger(0);
    setUpcomingFetchTrigger(0);
    setStateCountdown(nextConfig.state_refresh_after_seconds);
    setDiscoveryCountdown(nextConfig.discovery_refresh_after_seconds);
    setServiceDisabled(false);
    setErrorMessage(null);
    setLiveLoading(nextConfig.use_mock_data);
    setUpcomingLoading(nextConfig.use_mock_data);
    setPeriodicUpdatesEnabled(nextConfig.use_mock_data);
    setStatusMessage(
      nextConfig.use_mock_data
        ? "Loading live sports intelligence..."
        : "Choose filters and click Load live matches."
    );
    setUpcomingStatusMessage(
      nextConfig.use_mock_data
        ? "Loading upcoming matches..."
        : "Choose filters and click Load upcoming matches."
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    configControllerRef.current?.abort();
    configControllerRef.current = controller;

    const loadConfig = async () => {
      try {
        const nextConfig = await fetchConfig(controller.signal);
        setConfig(nextConfig);
        setStateCountdown(nextConfig.state_refresh_after_seconds);
        setDiscoveryCountdown(nextConfig.discovery_refresh_after_seconds);
        setPeriodicUpdatesEnabled(nextConfig.use_mock_data);
        if (nextConfig.use_mock_data) {
          setStatusMessage("Loading live sports intelligence...");
          setUpcomingStatusMessage("Loading upcoming matches...");
          setLiveLoading(true);
          setUpcomingLoading(true);
        } else {
          setStatusMessage("Choose filters and click Load live matches.");
          setUpcomingStatusMessage(
            "Choose filters and click Load upcoming matches."
          );
          setLiveLoading(false);
          setUpcomingLoading(false);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setErrorMessage((error as Error).message);
      }
    };

    void loadConfig();

    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    archiveControllerRef.current?.abort();
    archiveControllerRef.current = controller;
    setArchiveLoading(true);
    setArchiveError(null);

    void fetchTrackerArchives(controller.signal)
      .then((payload) => {
        setTrackerArchives(payload.archives);
        setArchiveStatusMessage(
          payload.archives.length > 0
            ? `Loaded ${payload.archives.length} archived tracked event${payload.archives.length === 1 ? "" : "s"}.`
            : "No archived tracked events are available yet."
        );
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setArchiveError((error as Error).message);
        setArchiveStatusMessage("Unable to load archived tracked events.");
      })
      .finally(() => setArchiveLoading(false));

    return () => controller.abort();
  }, [archiveReloadToken]);

  useEffect(() => {
    if (!selectedTrackerArchiveId) {
      setSelectedTrackerArchive(null);
      return;
    }

    const controller = new AbortController();
    archiveDetailControllerRef.current?.abort();
    archiveDetailControllerRef.current = controller;
    setArchiveLoading(true);
    setArchiveError(null);

    void fetchTrackerArchive(selectedTrackerArchiveId, controller.signal)
      .then((payload) => {
        setSelectedTrackerArchive(payload.archive);
        setArchiveStatusMessage(
          `Viewing archived tracker for ${payload.archive.summary.match_name}.`
        );
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setArchiveError((error as Error).message);
        setArchiveStatusMessage("Unable to load archived tracker.");
      })
      .finally(() => setArchiveLoading(false));

    return () => controller.abort();
  }, [selectedTrackerArchiveId]);

  useEffect(() => {
    if (!selectedLiveMatchId) {
      setSelectedLiveMatchDetail(null);
      if (!selectedUpcomingMatchId) {
        setDetailStatus("idle");
        setDetailError(null);
      }
      return;
    }
    setSelectedUpcomingMatchDetail(null);
    setDetailError(null);
    const selectedEvent =
      events.find((event) => event.match_id === selectedLiveMatchId) ?? null;

    if (!selectedEvent || !selectedEvent.context) {
      setSelectedLiveMatchDetail(null);
      setDetailError("Selected live match is no longer available.");
      setDetailStatus("error");
      return;
    }

    setSelectedLiveMatchDetail({
      matchId: selectedLiveMatchId,
      context: selectedEvent.context,
      liveState: selectedEvent.live_state
    });
    setDetailStatus("ready");
  }, [events, selectedLiveMatchId, selectedUpcomingMatchId]);

  useEffect(() => {
    if (!trackedLiveMatchId) {
      setTrackerHistory([]);
      setTrackedLiveSnapshot(null);
      setTrackerError(null);
      setTrackerLoading(false);
      setTrackerUpdatesEnabled(false);
      setTrackerCountdown(trackerPollingIntervalSeconds);
      setTrackerStatusMessage(TRACKER_IDLE_MESSAGE);
      return;
    }

    if (!trackedLiveSnapshot || !trackedLiveSnapshot.context) {
      const nextTrackedEvent =
        trackableEvents.find((event) => event.match_id === trackedLiveMatchId) ??
        null;
      if (nextTrackedEvent) {
        setTrackedLiveSnapshot(nextTrackedEvent);
      } else {
        setTrackerError("Tracked match is no longer available in the live slate.");
        setTrackerStatusMessage("Tracked match is unavailable.");
      }
      return;
    }

    if (!trackedLiveSnapshot.context) {
      setTrackerError("Tracked match is no longer available in the live slate.");
      setTrackerStatusMessage("Tracked match is unavailable.");
      return;
    }

    if (!trackerUpdatesEnabled) {
      setTrackerUpdatesEnabled(true);
    }

    setTrackerError(null);
    const trackedMatchName = trackedLiveSnapshot.context.match.match_name;
    setTrackerHistory((current) =>
      appendTrackerHistory(current, trackedLiveSnapshot.live_state)
    );
    setTrackerStatusMessage((current) => {
      if (
        current === TRACKER_IDLE_MESSAGE ||
        current === "Preparing tracked match view..." ||
        current === "Tracked match is unavailable."
      ) {
        return `Tracking ${trackedMatchName}.`;
      }

      return current;
    });
  }, [
    trackableEvents,
    trackedLiveMatchId,
    trackedLiveSnapshot,
    trackerPollingIntervalSeconds,
    trackerUpdatesEnabled
  ]);

  useEffect(() => {
    if (!selectedUpcomingMatchId) {
      setSelectedUpcomingMatchDetail(null);
      if (!selectedLiveMatchId) {
        setDetailStatus("idle");
        setDetailError(null);
      }
      return;
    }
    setSelectedLiveMatchDetail(null);
    setDetailError(null);
    const selectedEvent =
      upcomingEvents.find(
        (event) => event.match_id === selectedUpcomingMatchId
      ) ?? null;

    if (!selectedEvent) {
      setSelectedUpcomingMatchDetail(null);
      setDetailError("Selected upcoming match is no longer available.");
      setDetailStatus("error");
      return;
    }

    setSelectedUpcomingMatchDetail(selectedEvent);
    setDetailStatus("ready");
  }, [selectedLiveMatchId, selectedUpcomingMatchId, upcomingEvents]);

  useEffect(() => {
    if (!config || serviceDisabled) {
      return;
    }

    if (config.use_mock_data) {
      setLiveFetchTrigger((current) => current + 1);
      return;
    }

    setEvents([]);
    setStaleMatchIds([]);
    setLiveWarnings([]);
    setSelectedLiveMatchId(null);
    setSelectedLiveMatchDetail(null);
    setTrackedLiveMatchId(null);
    setTrackedLiveSnapshot(null);
    setTrackerHistory([]);
    setTrackerUpdatesEnabled(false);
    setTrackerLoading(false);
    setTrackerError(null);
    setTrackerCountdown(60);
    setTrackerStatusMessage(TRACKER_IDLE_MESSAGE);
    setHasLoadedLiveOnce(false);
    setStateCountdown(config.state_refresh_after_seconds);
    setDiscoveryCountdown(config.discovery_refresh_after_seconds);
    setLiveLoading(false);
    setErrorMessage(null);
    setStatusMessage("Choose filters and click Load live matches.");
  }, [config, filters.region, filters.sport, reloadToken, serviceDisabled]);

  useEffect(() => {
    if (!config || serviceDisabled) {
      return;
    }

    if (config.use_mock_data) {
      setUpcomingFetchTrigger((current) => current + 1);
      return;
    }

    setUpcomingEvents([]);
    setUpcomingWarnings([]);
    setSelectedUpcomingMatchId(null);
    setSelectedUpcomingMatchDetail(null);
    setHasLoadedUpcomingOnce(false);
    setUpcomingLoading(false);
    setErrorMessage(null);
    setUpcomingStatusMessage("Choose filters and click Load upcoming matches.");
  }, [
    config,
    filters.region,
    filters.sport,
    upcomingDays,
    reloadToken,
    serviceDisabled
  ]);

  useEffect(() => {
    setTrackerCountdown(trackerPollingIntervalSeconds);
  }, [trackerPollingIntervalSeconds]);

  useEffect(() => {
    if (!config || serviceDisabled || liveFetchTrigger === 0) {
      return;
    }

    const controller = new AbortController();
    liveControllerRef.current?.abort();
    liveControllerRef.current = controller;

    const loadLiveEvents = async () => {
      setLiveLoading(true);
      setStatusMessage("Loading live sports intelligence...");
      setErrorMessage(null);
      try {
        const discovery = await discoverLiveEvents(
          {
            region: filters.region,
            sport: filters.sport,
            include_context: true,
            request_origin: "live_page"
          },
          controller.signal
        );

        setEvents((current) =>
          preserveCurrentSlateOnWeakDiscovery(current, discovery.data.events)
            ? current
            : mergeDiscovery(current, discovery.data.events)
        );
        setStaleMatchIds([]);
        setLiveWarnings(filterUiWarnings(discovery.warnings));
        setServiceDisabled(false);
        setHasLoadedLiveOnce(true);
        setStateCountdown(config.state_refresh_after_seconds);
        setDiscoveryCountdown(config.discovery_refresh_after_seconds);
        setStatusMessage(
          discovery.data.events.length > 0
            ? "Live events loaded."
            : events.length > 0
              ? "No newly verified live matches were returned. Keeping the previous live slate."
            : "No live matches were returned for the current filter."
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        if (error instanceof ApiError && error.code === "AI_USAGE_DISABLED") {
          setServiceDisabled(true);
          setStatusMessage(
            "Live sports intelligence is temporarily unavailable."
          );
          setUpcomingStatusMessage(
            "Upcoming sports intelligence is temporarily unavailable."
          );
          return;
        }
        setErrorMessage((error as Error).message);
        setStatusMessage("Unable to load live events.");
      } finally {
        setLiveLoading(false);
      }
    };

    void loadLiveEvents();

    return () => controller.abort();
  }, [
    config,
    filters.region,
    filters.sport,
    liveFetchTrigger,
    serviceDisabled
  ]);

  useEffect(() => {
    if (!config || serviceDisabled || upcomingFetchTrigger === 0) {
      return;
    }

    const controller = new AbortController();
    upcomingControllerRef.current?.abort();
    upcomingControllerRef.current = controller;

    const loadUpcomingEvents = async () => {
      setUpcomingLoading(true);
      setUpcomingStatusMessage("Loading upcoming matches...");
      try {
        const upcoming = await fetchUpcomingEvents(
          {
            region: filters.region,
            sport: filters.sport,
            days: upcomingDays,
            request_origin: "upcoming_page"
          },
          controller.signal
        );
        setUpcomingEvents(upcoming.data.events);
        setUpcomingWarnings(filterUiWarnings(upcoming.warnings));
        setHasLoadedUpcomingOnce(true);
        setUpcomingStatusMessage(
          upcoming.data.events.length > 0
            ? `Upcoming slate loaded for the next ${upcomingDays} days.`
            : `No upcoming ${filters.sport} matches were returned for the next ${upcomingDays} days.`
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        if (error instanceof ApiError && error.code === "AI_USAGE_DISABLED") {
          setServiceDisabled(true);
          setStatusMessage(
            "Live sports intelligence is temporarily unavailable."
          );
          setUpcomingStatusMessage(
            "Upcoming sports intelligence is temporarily unavailable."
          );
          return;
        }
        setErrorMessage((error as Error).message);
        setUpcomingStatusMessage("Unable to load upcoming matches.");
      } finally {
        setUpcomingLoading(false);
      }
    };

    void loadUpcomingEvents();

    return () => controller.abort();
  }, [
    config,
    filters.region,
    filters.sport,
    upcomingDays,
    upcomingFetchTrigger,
    serviceDisabled
  ]);

  useEffect(() => {
    if (
      !config ||
      serviceDisabled ||
      !hasLoadedLiveOnce ||
      !periodicUpdatesEnabled
    ) {
      return;
    }

    const tick = window.setInterval(() => {
      setStateCountdown((current) =>
        current > 0 ? current - 1 : config.state_refresh_after_seconds
      );
      setDiscoveryCountdown((current) =>
        current > 0 ? current - 1 : config.discovery_refresh_after_seconds
      );
    }, 1000);

    return () => window.clearInterval(tick);
  }, [config, hasLoadedLiveOnce, periodicUpdatesEnabled, serviceDisabled]);

  useEffect(() => {
    if (
      !config ||
      serviceDisabled ||
      !hasLoadedLiveOnce ||
      !periodicUpdatesEnabled ||
      events.length === 0
    ) {
      return;
    }

    if (stateCountdown !== 0) {
      return;
    }

    const controller = new AbortController();
    setStatusMessage("Updating live scores and match state...");
    void refreshLiveStates(
      {
        region: filters.region,
        sport: filters.sport,
        request_origin: "live_page",
        matches: eventIdentities
      },
      controller.signal
    )
      .then((payload) => {
        const nextStates = new Map(
          payload.data.states.map((state) => [state.match_id, state])
        );
        setEvents((current) => mergeStates(current, nextStates));
        setStaleMatchIds(
          payload.data.failed_matches.map((match) => match.match_id)
        );
        setLiveWarnings(filterUiWarnings(payload.warnings));
        setStateCountdown(config.state_refresh_after_seconds);
        setStatusMessage(
          payload.data.failed_matches.length > 0
            ? "Live state refreshed with partial stale matches."
            : "Live state refreshed."
        );
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === "AI_USAGE_DISABLED") {
          setServiceDisabled(true);
          setStatusMessage(
            "Live sports intelligence is temporarily unavailable."
          );
          setUpcomingStatusMessage(
            "Upcoming sports intelligence is temporarily unavailable."
          );
          return;
        }
        setStaleMatchIds(events.map((event) => event.match_id));
        setErrorMessage((error as Error).message);
        setStatusMessage("State refresh failed.");
      });

    return () => controller.abort();
  }, [
    config,
    eventIdentities,
    events,
    events.length,
    filters.region,
    filters.sport,
    hasLoadedLiveOnce,
    periodicUpdatesEnabled,
    serviceDisabled,
    stateCountdown
  ]);

  useEffect(() => {
    if (
      !trackedLiveMatchId ||
      !trackedLiveEvent ||
      !trackedLiveEvent.context ||
      !trackerUpdatesEnabled
    ) {
      return;
    }

    const tick = window.setInterval(() => {
      setTrackerCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(tick);
  }, [trackedLiveEvent, trackedLiveMatchId, trackerUpdatesEnabled]);

  useEffect(() => {
    if (
      !config ||
      serviceDisabled ||
      !hasLoadedLiveOnce ||
      !periodicUpdatesEnabled
    ) {
      return;
    }

    if (discoveryCountdown !== 0) {
      return;
    }

    const controller = new AbortController();
    void discoverLiveEvents(
      {
        region: filters.region,
        sport: filters.sport,
        include_context: true,
        request_origin: "live_page",
        known_matches: events.map((event) => ({
          match_id: event.match_id,
          context_fingerprint: event.context_fingerprint
        }))
      },
      controller.signal
    )
      .then((payload) => {
        setEvents((current) =>
          preserveCurrentSlateOnWeakDiscovery(current, payload.data.events)
            ? current
            : mergeDiscovery(current, payload.data.events)
        );
        setLiveWarnings(filterUiWarnings(payload.warnings));
        setStaleMatchIds((current) =>
          current.filter((matchId) =>
            payload.data.events.some((event) => event.match_id === matchId)
          )
        );
        setDiscoveryCountdown(config.discovery_refresh_after_seconds);
        if (payload.data.events.length === 0 && events.length > 0) {
          setStatusMessage(
            "No newly verified live matches were returned. Keeping the previous live slate."
          );
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === "AI_USAGE_DISABLED") {
          setServiceDisabled(true);
          setStatusMessage(
            "Live sports intelligence is temporarily unavailable."
          );
          setUpcomingStatusMessage(
            "Upcoming sports intelligence is temporarily unavailable."
          );
        }
      });

    return () => controller.abort();
  }, [
    config,
    discoveryCountdown,
    events,
    filters.region,
    filters.sport,
    hasLoadedLiveOnce,
    periodicUpdatesEnabled,
    serviceDisabled
  ]);

  const loadLiveNow = async () => {
    if (!config) {
      return;
    }
    setLiveFetchTrigger((current) => current + 1);
  };

  const loadUpcomingNow = async () => {
    if (!config) {
      return;
    }
    setUpcomingFetchTrigger((current) => current + 1);
  };

  const refreshStateNow = async () => {
    if (!config || !hasLoadedLiveOnce) {
      return;
    }
    setStateCountdown(0);
  };

  const refreshTrackedMatchNow = async () => {
    if (!trackedLiveSnapshot || !trackedLiveSnapshot.context) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      trackerRequestTimeoutMs
    );

    setTrackerLoading(true);
    setTrackerError(null);
    setTrackerStatusMessage(
      "Refreshing tracked match. Live provider calls can take several seconds."
    );

    try {
      const payload = await refreshLiveStates(
        {
          region: filters.region,
          sport: filters.sport,
          request_origin: "tracker",
          matches: [buildIdentity(trackedLiveSnapshot)]
        },
        controller.signal
      );

      const failedMatch = payload.data.failed_matches.find(
        (match) => match.match_id === trackedLiveSnapshot.match_id
      );
      if (failedMatch) {
        setTrackerError(failedMatch.message);
        setTrackerStatusMessage("Tracked match refresh failed.");
        setTrackerCountdown(trackerPollingIntervalSeconds);
        return;
      }

      const nextState = payload.data.states.find(
        (state) => state.match_id === trackedLiveSnapshot.match_id
      );
      if (!nextState) {
        setTrackerError("Tracked match state was not returned.");
        setTrackerStatusMessage("Tracked match refresh failed.");
        setTrackerCountdown(trackerPollingIntervalSeconds);
        return;
      }

      const acceptedState = shouldAcceptLiveStateUpdate(
        trackedLiveSnapshot.live_state,
        nextState
      )
        ? nextState
        : trackedLiveSnapshot.live_state;

      setEvents((current) =>
        mergeStates(
          current,
          new Map([[trackedLiveSnapshot.match_id, acceptedState]])
        )
      );
      setTrackedLiveSnapshot((current) =>
        current
          ? {
              ...current,
              live_state: acceptedState,
              freshness: {
                ...current.freshness,
                state_generated_at: acceptedState.freshness.generated_at,
                state_age_seconds: acceptedState.freshness.age_seconds
              }
            }
          : current
      );
      setTrackerHistory((current) =>
        appendTrackerHistory(current, acceptedState)
      );
      setTrackerCountdown(trackerPollingIntervalSeconds);
      setTrackerStatusMessage(
        payload.warnings.length > 0
          ? "Tracked match refreshed with provider warnings."
          : "Tracked match refreshed."
      );
      setLiveWarnings(filterUiWarnings(payload.warnings));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setTrackerError(
          "Tracked match refresh timed out before the provider returned."
        );
        setTrackerStatusMessage("Tracked match refresh timed out.");
        setTrackerCountdown(trackerPollingIntervalSeconds);
        return;
      }

      if (error instanceof ApiError && error.code === "AI_USAGE_DISABLED") {
        setServiceDisabled(true);
        setStatusMessage("Live sports intelligence is temporarily unavailable.");
        setUpcomingStatusMessage(
          "Upcoming sports intelligence is temporarily unavailable."
        );
        return;
      }

      setTrackerError((error as Error).message);
      setTrackerStatusMessage("Tracked match refresh failed.");
      setTrackerCountdown(trackerPollingIntervalSeconds);
    } finally {
      window.clearTimeout(timeout);
      setTrackerLoading(false);
    }
  };

  useEffect(() => {
    if (
      !trackedLiveMatchId ||
      !trackedLiveSnapshot ||
      !trackerUpdatesEnabled ||
      trackerLoading
    ) {
      return;
    }

    if (trackerCountdown !== 0) {
      return;
    }

    void refreshTrackedMatchNow();
  }, [
    trackedLiveSnapshot,
    trackedLiveMatchId,
    trackerCountdown,
    trackerLoading,
    trackerRequestTimeoutMs,
    trackerUpdatesEnabled
  ]);

  useEffect(() => {
    if (
      !trackedLiveSnapshot ||
      trackerHistory.length === 0 ||
      !TERMINAL_MATCH_STATUSES.has(trackedLiveSnapshot.live_state.match_status)
    ) {
      return;
    }

    const lastCapturedAt = trackerHistory.at(-1)?.capturedAt;
    if (!lastCapturedAt) {
      return;
    }

    const archiveKey = `${trackedLiveSnapshot.match_id}:${lastCapturedAt}`;
    if (lastArchivedTrackerPointRef.current === archiveKey) {
      return;
    }

    lastArchivedTrackerPointRef.current = archiveKey;
    void persistTrackerArchive({
      event: trackedLiveSnapshot,
      history: trackerHistory
    })
      .then(() => {
        setArchiveReloadToken((current) => current + 1);
      })
      .catch(() => {
        lastArchivedTrackerPointRef.current = null;
      });
  }, [trackedLiveSnapshot, trackerHistory]);

  const rediscoverNow = async () => {
    if (!config || !hasLoadedLiveOnce) {
      return;
    }
    setDiscoveryCountdown(0);
  };

  const retryAfterDisabled = async () => {
    setServiceDisabled(false);
    setReloadToken((current) => current + 1);
  };

  const changeActiveModel = async (mode: ProviderMode) => {
    if (!config || config.active_model === mode) {
      return;
    }

    const controller = new AbortController();
    configControllerRef.current?.abort();
    configControllerRef.current = controller;
    setLiveLoading(true);
    setUpcomingLoading(true);
    setStatusMessage("Switching data source...");
    setUpcomingStatusMessage("Switching data source...");
    setErrorMessage(null);

    try {
      const nextConfig = await switchActiveModel(mode, controller.signal);
      resetLoadedState(nextConfig);
      setConfig(nextConfig);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      setErrorMessage((error as Error).message);
      setStatusMessage("Unable to switch data source.");
      setUpcomingStatusMessage("Unable to switch data source.");
      setLiveLoading(false);
      setUpcomingLoading(false);
    }
  };

  const selectLiveMatch = (matchId: string) => {
    setSelectedUpcomingMatchId(null);
    setSelectedLiveMatchId(matchId);
  };

  const selectUpcomingMatch = (matchId: string) => {
    setSelectedLiveMatchId(null);
    setSelectedUpcomingMatchId(matchId);
  };

  const selectTrackedLiveMatch = (matchId: string) => {
    if (!matchId) {
      setTrackedLiveMatchId(null);
      setTrackedLiveSnapshot(null);
      setTrackerHistory([]);
      setTrackerUpdatesEnabled(false);
      setTrackerCountdown(trackerPollingIntervalSeconds);
      setTrackerError(null);
      setTrackerStatusMessage(TRACKER_IDLE_MESSAGE);
      return;
    }

    setTrackedLiveMatchId(matchId);
    setTrackedLiveSnapshot(
      trackableEvents.find((event) => event.match_id === matchId) ?? null
    );
    setTrackerHistory([]);
    setTrackerCountdown(trackerPollingIntervalSeconds);
    setTrackerError(null);
    setTrackerStatusMessage("Preparing tracked match view...");
  };

  const clearDetailSelection = () => {
    detailControllerRef.current?.abort();
    setSelectedLiveMatchId(null);
    setSelectedUpcomingMatchId(null);
    setSelectedLiveMatchDetail(null);
    setSelectedUpcomingMatchDetail(null);
    setDetailStatus("idle");
    setDetailError(null);
  };

  const loadTrackerArchivesNow = async () => {
    setArchiveReloadToken((current) => current + 1);
  };

  const selectTrackerArchive = (archiveId: string) => {
    setSelectedTrackerArchiveId(archiveId || null);
  };

  return {
    config,
    events,
    trackableEvents,
    trackedLiveEvent,
    trackerHistory,
    upcomingEvents,
    liveLoading,
    upcomingLoading,
    staleMatchIds,
    selectedLiveMatchId,
    selectedUpcomingMatchId,
    selectedLiveMatchDetail,
    selectedUpcomingMatchDetail,
    liveWarnings,
    upcomingWarnings,
    detailStatus,
    detailError,
    upcomingDays,
    manualFetchMode,
    periodicUpdatesEnabled,
    upcomingStatusMessage,
    errorMessage,
    filters,
    serviceDisabled,
    statusMessage,
    stateCountdown,
    discoveryCountdown,
    trackedLiveMatchId,
    trackerPollingIntervalSeconds,
    trackerUpdatesEnabled,
    trackerCountdown,
    trackerLoading,
    trackerStatusMessage,
    trackerError,
    trackerLastUpdatedAt,
    trackerArchives,
    selectedTrackerArchive,
    selectedTrackerArchiveId,
    archiveLoading,
    archiveError,
    archiveStatusMessage,
    hasLoadedLiveOnce,
    hasLoadedUpcomingOnce,
    setFilters,
    setUpcomingDays,
    setPeriodicUpdatesEnabled,
    setTrackerPollingIntervalSeconds,
    setTrackerUpdatesEnabled,
    selectLiveMatch,
    selectUpcomingMatch,
    selectTrackedLiveMatch,
    selectTrackerArchive,
    clearDetailSelection,
    loadLiveNow,
    loadUpcomingNow,
    loadTrackerArchivesNow,
    refreshStateNow,
    refreshTrackedMatchNow,
    rediscoverNow,
    retryAfterDisabled,
    changeActiveModel
  };
};
