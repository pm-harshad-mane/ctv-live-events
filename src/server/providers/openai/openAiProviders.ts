import type {
  DiscoverRequest,
  LiveEvent,
  LiveState,
  MatchContext,
  MatchIdentity,
  UpcomingEvent
} from "../../../shared/schemas/live";
import {
  liveEventSchema,
  liveStateSchema,
  matchContextSchema,
  upcomingEventSchema
} from "../../../shared/schemas/live";
import type { ProviderDebugInfo } from "../../../shared/types/api";
import {
  buildContextLookupPrompt,
  buildDiscoveryPrompt,
  buildLiveLookupPrompt,
  buildStateLookupPrompt,
  buildStateRefreshPrompt,
  buildUpcomingLookupPrompt,
  buildUpcomingPrompt
} from "../../openai/prompts";
import { openAiSchemas } from "../../openai/schemas";
import type { StructuredResponseTransport } from "../../openai/transport";
import type {
  LiveEventDiscoveryProvider,
  LiveEventLookupProvider,
  LiveEventStateProvider,
  UpcomingEventProvider
} from "../types";

const failedMatchSchema = {
  match_id: "",
  code: "",
  message: ""
};

const supportedSports = new Set([
  "basketball",
  "soccer",
  "american-football",
  "baseball",
  "cricket",
  "hockey",
  "tennis",
  "mma"
]);
const minimumLiveVerificationConfidence = 0.55;

const matchesRequestedSport = (
  sport: string,
  candidateSport: string | undefined
): boolean => {
  if (!candidateSport) {
    return false;
  }

  if (sport === "all") {
    return supportedSports.has(candidateSport);
  }

  return candidateSport === sport;
};

const regionToUserLocation = (
  region: string
): {
  type: "approximate";
  country: string;
  city?: string;
  region?: string;
  timezone?: string;
} => {
  switch (region) {
    case "europe":
      return {
        type: "approximate",
        country: "GB",
        city: "London",
        region: "England",
        timezone: "Europe/London"
      };
    case "latin-america":
      return {
        type: "approximate",
        country: "BR",
        city: "Sao Paulo",
        region: "Sao Paulo",
        timezone: "America/Sao_Paulo"
      };
    case "asia-pacific":
      return {
        type: "approximate",
        country: "AU",
        city: "Sydney",
        region: "New South Wales",
        timezone: "Australia/Sydney"
      };
    case "north-america":
      return {
        type: "approximate",
        country: "US",
        city: "New York",
        region: "New York",
        timezone: "America/New_York"
      };
    default:
      return {
        type: "approximate",
        country: "US",
        timezone: "UTC"
      };
  }
};

const withSportsWebSearch = (
  region: string
): Pick<
  Parameters<StructuredResponseTransport["createStructuredResponse"]>[0],
  "tools" | "toolChoice" | "include"
> => ({
  tools: [
    {
      type: "web_search",
      user_location: regionToUserLocation(region),
      external_web_access: true
    }
  ],
  toolChoice: "auto",
  include: ["web_search_call.action.sources"]
});

const isBlank = (value: string | undefined | null): boolean =>
  !value || value.trim().length === 0;

const hasCompleteVenue = (context: MatchContext | null): boolean =>
  Boolean(
    context &&
    !isBlank(context.match.venue.stadium) &&
    !isBlank(context.match.venue.city) &&
    !isBlank(context.match.venue.state) &&
    !isBlank(context.match.venue.country)
  );

const hasVerifiedLiveSignal = (state: LiveState): boolean => {
  const headline = state.what_is_happening.headline.toLowerCase();
  const summary = state.what_is_happening.summary.toLowerCase();
  const shortByte = state.summary.short_byte.toLowerCase();
  const text = `${headline} ${summary} ${shortByte}`;

  const scheduleOnlyLanguage =
    text.includes("scheduled for today") ||
    text.includes("no verified live action") ||
    text.includes("awaiting live feed") ||
    text.includes("listed on the schedule") ||
    text.includes("inferred from schedule");

  const zeroClock =
    state.clock.remaining_seconds === 0 &&
    (isBlank(state.clock.display) || state.clock.display === "0:00");
  const noScore =
    state.score.participant_scores.every(
      (participant) => participant.numeric_score === 0
    ) && state.score.score_differential === 0;

  return !scheduleOnlyLanguage && !(zeroClock && noScore);
};

const assessLiveStateQuality = (
  state: LiveState
): { accepted: boolean; reason?: string } => {
  if (state.match_status !== "live") {
    return {
      accepted: false,
      reason: "Match was not verified as currently live."
    };
  }

  if (state.verification.confidence < minimumLiveVerificationConfidence) {
    return {
      accepted: false,
      reason: `Live verification confidence ${Math.round(
        state.verification.confidence * 100
      )}% is below the display threshold.`
    };
  }

  if (!hasVerifiedLiveSignal(state)) {
    return {
      accepted: false,
      reason: "Only schedule-level evidence was available for this live match."
    };
  }

  return { accepted: true };
};

const assessLiveEventQuality = (
  event: LiveEvent
): { accepted: boolean; reason?: string } => {
  if (!event.context) {
    return {
      accepted: false,
      reason: "Live match context could not be verified."
    };
  }

  if (!hasCompleteVenue(event.context)) {
    return {
      accepted: false,
      reason: "Venue details were incomplete for this live match."
    };
  }

  return assessLiveStateQuality(event.live_state);
};

const assertObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI structured response was not an object.");
  }
  return value as Record<string, unknown>;
};

const normalizeUnitInterval = (value: unknown): unknown => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  if (value > 1 && value <= 100) {
    return value / 100;
  }

  if (value > 100) {
    return 1;
  }

  if (value < 0) {
    return 0;
  }

  return value;
};

const normalizeProbabilityEntryArray = (
  value: unknown,
  field: string
): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((entry) => {
    const candidate = assertObject(entry);
    return {
      ...candidate,
      [field]: normalizeUnitInterval(candidate[field])
    };
  });
};

const normalizeLiveStateCandidate = (value: unknown): unknown => {
  const candidate = assertObject(value);
  const livePredictions = assertObject(candidate.live_predictions);
  const verification = assertObject(candidate.verification);

  return {
    ...candidate,
    verification: {
      ...verification,
      confidence: normalizeUnitInterval(verification.confidence)
    },
    live_predictions: {
      ...livePredictions,
      win_probabilities: normalizeProbabilityEntryArray(
        livePredictions.win_probabilities,
        "probability"
      ),
      win_probability_changes: normalizeProbabilityEntryArray(
        livePredictions.win_probability_changes,
        "last_interval"
      ),
      comeback_probability: normalizeUnitInterval(
        livePredictions.comeback_probability
      ),
      upset_probability: normalizeUnitInterval(
        livePredictions.upset_probability
      ),
      draw_probability: normalizeUnitInterval(livePredictions.draw_probability),
      overtime_or_tiebreak_probability: normalizeUnitInterval(
        livePredictions.overtime_or_tiebreak_probability
      ),
      prediction_confidence: normalizeUnitInterval(
        livePredictions.prediction_confidence
      )
    }
  };
};

const normalizeUpcomingEventCandidate = (value: unknown): unknown => {
  const candidate = assertObject(value);
  const intelligence = assertObject(candidate.upcoming_intelligence);

  return {
    ...candidate,
    upcoming_intelligence: {
      ...intelligence,
      win_probabilities: normalizeProbabilityEntryArray(
        intelligence.win_probabilities,
        "probability"
      )
    }
  };
};

const normalizeLiveEventCandidate = (value: unknown): unknown => {
  const candidate = assertObject(value);

  return {
    ...candidate,
    live_state: normalizeLiveStateCandidate(candidate.live_state)
  };
};

const getProviderDebug = (
  payload: Record<string, unknown>
): ProviderDebugInfo => {
  const metadata =
    "_openai_metadata" in payload &&
    payload._openai_metadata &&
    typeof payload._openai_metadata === "object"
      ? (payload._openai_metadata as Record<string, unknown>)
      : null;
  const webSearch =
    metadata &&
    "web_search" in metadata &&
    metadata.web_search &&
    typeof metadata.web_search === "object"
      ? (metadata.web_search as Record<string, unknown>)
      : null;

  return {
    openai_web_search: {
      required: true,
      tool_invoked: Boolean(webSearch?.tool_invoked),
      call_count:
        typeof webSearch?.call_count === "number" ? webSearch.call_count : 0,
      source_count:
        typeof webSearch?.source_count === "number"
          ? webSearch.source_count
          : 0,
      sources: Array.isArray(webSearch?.sources)
        ? webSearch.sources.map((source) => String(source))
        : []
    }
  };
};

const webSearchWasInvoked = (providerDebug: ProviderDebugInfo): boolean =>
  Boolean(providerDebug.openai_web_search?.tool_invoked);

const missingWebSearchWarning =
  "OpenAI response was rejected because no web_search_call was present, even though web search is required for this endpoint.";

export class OpenAiLiveEventDiscoveryProvider implements LiveEventDiscoveryProvider {
  constructor(private readonly transport: StructuredResponseTransport) {}

  async discover(input: DiscoverRequest) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildDiscoveryPrompt(input),
        ...withSportsWebSearch(input.region),
        schema: openAiSchemas.discovery
      })
    );
    const providerDebug = getProviderDebug(payload);
    if (!webSearchWasInvoked(providerDebug)) {
      return {
        events: [],
        warnings: [missingWebSearchWarning],
        provider_debug: providerDebug
      };
    }

    const warnings = Array.isArray(payload.warnings)
      ? payload.warnings.map((warning) => String(warning))
      : [];

    const events = Array.isArray(payload.events)
      ? payload.events
          .map((event) =>
            liveEventSchema.parse(normalizeLiveEventCandidate(event))
          )
          .filter((event) =>
            matchesRequestedSport(input.sport, event.context?.match.sport)
          )
      : [];

    const acceptedEvents: LiveEvent[] = [];
    for (const event of events) {
      const quality = assessLiveEventQuality(event);
      if (quality.accepted) {
        acceptedEvents.push(event);
        continue;
      }
      warnings.push(
        `${event.context?.match.match_name ?? event.match_id} was excluded from live results: ${quality.reason}`
      );
    }

    return {
      events: acceptedEvents,
      warnings,
      provider_debug: providerDebug
    };
  }
}

export class OpenAiLiveEventStateProvider implements LiveEventStateProvider {
  constructor(private readonly transport: StructuredResponseTransport) {}

  async refreshStates(input: {
    region: string;
    sport: string;
    matches: MatchIdentity[];
  }) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildStateRefreshPrompt(input),
        ...withSportsWebSearch(input.region),
        schema: openAiSchemas.stateRefresh
      })
    );
    const providerDebug = getProviderDebug(payload);
    if (!webSearchWasInvoked(providerDebug)) {
      return {
        states: [],
        failed_matches: input.matches.map((match) => ({
          match_id: match.match_id,
          code: "WEB_SEARCH_REQUIRED",
          message: missingWebSearchWarning
        })),
        warnings: [missingWebSearchWarning],
        provider_debug: providerDebug
      };
    }

    const warnings = Array.isArray(payload.warnings)
      ? payload.warnings.map((warning) => String(warning))
      : [];

    const states = Array.isArray(payload.states)
      ? payload.states.map((state) =>
          liveStateSchema.parse(normalizeLiveStateCandidate(state))
        )
      : [];
    const failedMatches = Array.isArray(payload.failed_matches)
      ? payload.failed_matches.map((item) => {
          const candidate = assertObject(item);
          return {
            match_id: String(candidate.match_id ?? failedMatchSchema.match_id),
            code: String(candidate.code ?? failedMatchSchema.code),
            message: String(candidate.message ?? failedMatchSchema.message)
          };
        })
      : [];

    const acceptedStates: LiveState[] = [];
    for (const state of states) {
      const quality = assessLiveStateQuality(state);
      if (quality.accepted) {
        acceptedStates.push(state);
        continue;
      }

      failedMatches.push({
        match_id: state.match_id,
        code: "LOW_CONFIDENCE_LIVE_STATE",
        message: quality.reason ?? "Live state did not meet the quality gate."
      });
      warnings.push(
        `${state.match_id} was removed from live state refresh: ${quality.reason}`
      );
    }

    return {
      states: acceptedStates,
      failed_matches: failedMatches,
      warnings,
      provider_debug: providerDebug
    };
  }
}

export class OpenAiLiveEventLookupProvider implements LiveEventLookupProvider {
  constructor(private readonly transport: StructuredResponseTransport) {}

  async getContext(matchId: string): Promise<MatchContext | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildContextLookupPrompt(matchId),
        ...withSportsWebSearch("global"),
        schema: openAiSchemas.contextLookup
      })
    );
    if (!webSearchWasInvoked(getProviderDebug(payload))) {
      return null;
    }
    return payload.context ? matchContextSchema.parse(payload.context) : null;
  }

  async getState(matchId: string): Promise<LiveState | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildStateLookupPrompt(matchId),
        ...withSportsWebSearch("global"),
        schema: openAiSchemas.stateLookup
      })
    );
    if (!webSearchWasInvoked(getProviderDebug(payload))) {
      return null;
    }
    return payload.live_state
      ? liveStateSchema.parse(normalizeLiveStateCandidate(payload.live_state))
      : null;
  }

  async getLiveEvent(matchId: string): Promise<LiveEvent | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildLiveLookupPrompt(matchId),
        ...withSportsWebSearch("global"),
        schema: openAiSchemas.liveLookup
      })
    );
    if (!webSearchWasInvoked(getProviderDebug(payload))) {
      return null;
    }
    if (!payload.event) {
      return null;
    }

    const event = liveEventSchema.parse(
      normalizeLiveEventCandidate(payload.event)
    );
    return assessLiveEventQuality(event).accepted ? event : null;
  }
}

export class OpenAiUpcomingEventProvider implements UpcomingEventProvider {
  constructor(private readonly transport: StructuredResponseTransport) {}

  async getUpcoming(input: { region: string; sport: string; days: number }) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildUpcomingPrompt(input),
        ...withSportsWebSearch(input.region),
        schema: openAiSchemas.upcoming
      })
    );
    const providerDebug = getProviderDebug(payload);
    if (!webSearchWasInvoked(providerDebug)) {
      return {
        events: [],
        warnings: [missingWebSearchWarning],
        provider_debug: providerDebug
      };
    }

    return {
      events: Array.isArray(payload.events)
        ? payload.events
            .map((event) =>
              upcomingEventSchema.parse(normalizeUpcomingEventCandidate(event))
            )
            .filter((event) =>
              matchesRequestedSport(input.sport, event.context.match.sport)
            )
        : [],
      warnings: Array.isArray(payload.warnings)
        ? payload.warnings.map((warning) => String(warning))
        : [],
      provider_debug: providerDebug
    };
  }

  async getUpcomingByMatchId(matchId: string): Promise<UpcomingEvent | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildUpcomingLookupPrompt(matchId),
        ...withSportsWebSearch("global"),
        schema: openAiSchemas.upcomingLookup
      })
    );
    if (!webSearchWasInvoked(getProviderDebug(payload))) {
      return null;
    }
    return payload.event
      ? upcomingEventSchema.parse(
          normalizeUpcomingEventCandidate(payload.event)
        )
      : null;
  }
}
