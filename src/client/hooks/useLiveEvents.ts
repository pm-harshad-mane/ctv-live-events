import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LiveEvent,
  LiveState,
  MatchContext,
  MatchIdentity,
  PublicConfig,
  UpcomingEvent
} from "../../shared/schemas/live";
import {
  ApiError,
  discoverLiveEvents,
  fetchConfig,
  fetchLiveMatchContext,
  fetchLiveMatchState,
  fetchUpcomingEvents,
  refreshLiveStates
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

const buildIdentity = (event: LiveEvent): MatchIdentity => ({
  match_id: event.match_id,
  sport: event.context?.match.sport ?? "unknown",
  tournament_name: event.context?.match.tournament_name ?? "Unknown",
  scheduled_start_time:
    event.context?.match.scheduled_start_time ?? new Date().toISOString(),
  participants:
    event.context?.participants.map((participant) => ({
      participant_id: participant.participant_id,
      name: participant.name,
      short_name: participant.short_name
    })) ?? []
});

const mergeDiscovery = (
  currentEvents: LiveEvent[],
  incomingEvents: LiveEvent[]
): LiveEvent[] => {
  const byId = new Map(currentEvents.map((event) => [event.match_id, event]));
  for (const incoming of incomingEvents) {
    const existing = byId.get(incoming.match_id);
    byId.set(incoming.match_id, {
      ...incoming,
      context:
        incoming.context_status === "unchanged" && existing?.context
          ? existing.context
          : incoming.context,
      live_state: incoming.live_state
    });
  }
  return Array.from(byId.values());
};

const mergeStates = (
  currentEvents: LiveEvent[],
  nextStates: Map<string, LiveEvent["live_state"]>
): LiveEvent[] =>
  currentEvents.map((event) => {
    const nextState = nextStates.get(event.match_id);
    if (!nextState) {
      return event;
    }
    return {
      ...event,
      live_state: nextState,
      freshness: {
        ...event.freshness,
        state_generated_at: nextState.freshness.generated_at,
        state_age_seconds: nextState.freshness.age_seconds
      }
    };
  });

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
  const [reloadToken, setReloadToken] = useState(0);
  const liveControllerRef = useRef<AbortController | null>(null);
  const upcomingControllerRef = useRef<AbortController | null>(null);
  const configControllerRef = useRef<AbortController | null>(null);
  const detailControllerRef = useRef<AbortController | null>(null);

  const eventIdentities = useMemo(() => events.map(buildIdentity), [events]);

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
    if (!selectedLiveMatchId) {
      setSelectedLiveMatchDetail(null);
      if (!selectedUpcomingMatchId) {
        setDetailStatus("idle");
        setDetailError(null);
      }
      return;
    }

    const controller = new AbortController();
    detailControllerRef.current?.abort();
    detailControllerRef.current = controller;
    setSelectedUpcomingMatchDetail(null);
    setDetailStatus("loading");
    setDetailError(null);

    void Promise.all([
      fetchLiveMatchContext(selectedLiveMatchId, controller.signal),
      fetchLiveMatchState(selectedLiveMatchId, controller.signal)
    ])
      .then(([contextPayload, statePayload]) => {
        setSelectedLiveMatchDetail({
          matchId: selectedLiveMatchId,
          context: contextPayload.context,
          liveState: statePayload.live_state
        });
        setDetailStatus("ready");
      })
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setDetailError((error as Error).message);
        setDetailStatus("error");
      });

    return () => controller.abort();
  }, [selectedLiveMatchId, selectedUpcomingMatchId]);

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
      upcomingEvents.find((event) => event.match_id === selectedUpcomingMatchId) ??
      null;

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
    if (serviceDisabled) {
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
            include_context: true
          },
          controller.signal
        );

        setEvents(discovery.data.events);
        setStaleMatchIds([]);
        setLiveWarnings(discovery.warnings);
        setServiceDisabled(false);
        setHasLoadedLiveOnce(true);
        setStatusMessage(
          discovery.data.events.length > 0
            ? "Live events loaded."
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
  }, [filters.region, filters.sport, reloadToken, serviceDisabled]);

  useEffect(() => {
    if (serviceDisabled) {
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
            days: upcomingDays
          },
          controller.signal
        );
        setUpcomingEvents(upcoming.data.events);
        setUpcomingWarnings(upcoming.warnings);
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
    filters.region,
    filters.sport,
    upcomingDays,
    reloadToken,
    serviceDisabled
  ]);

  useEffect(() => {
    if (!config || serviceDisabled || !hasLoadedLiveOnce) {
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
  }, [config, hasLoadedLiveOnce, serviceDisabled]);

  useEffect(() => {
    if (
      !config ||
      serviceDisabled ||
      !hasLoadedLiveOnce ||
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
        setLiveWarnings(payload.warnings);
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
    serviceDisabled,
    stateCountdown
  ]);

  useEffect(() => {
    if (!config || serviceDisabled || !hasLoadedLiveOnce) {
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
        known_matches: events.map((event) => ({
          match_id: event.match_id,
          context_fingerprint: event.context_fingerprint
        }))
      },
      controller.signal
    )
      .then((payload) => {
        setEvents((current) => mergeDiscovery(current, payload.data.events));
        setLiveWarnings(payload.warnings);
        setStaleMatchIds((current) =>
          current.filter((matchId) =>
            payload.data.events.some((event) => event.match_id === matchId)
          )
        );
        setDiscoveryCountdown(config.discovery_refresh_after_seconds);
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
    serviceDisabled
  ]);

  const refreshStateNow = async () => {
    if (!config) {
      return;
    }
    setStateCountdown(0);
  };

  const rediscoverNow = async () => {
    if (!config) {
      return;
    }
    setDiscoveryCountdown(0);
  };

  const retryAfterDisabled = async () => {
    setServiceDisabled(false);
    setReloadToken((current) => current + 1);
  };

  const selectLiveMatch = (matchId: string) => {
    setSelectedUpcomingMatchId(null);
    setSelectedLiveMatchId(matchId);
  };

  const selectUpcomingMatch = (matchId: string) => {
    setSelectedLiveMatchId(null);
    setSelectedUpcomingMatchId(matchId);
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

  return {
    config,
    events,
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
    upcomingStatusMessage,
    errorMessage,
    filters,
    serviceDisabled,
    statusMessage,
    stateCountdown,
    discoveryCountdown,
    hasLoadedLiveOnce,
    setFilters,
    setUpcomingDays,
    selectLiveMatch,
    selectUpcomingMatch,
    clearDetailSelection,
    refreshStateNow,
    rediscoverNow,
    retryAfterDisabled
  };
};
