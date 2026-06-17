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
import type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../../openai/transport";
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

const assertObject = (
  value: unknown,
  responseObjectLabel: string
): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    throw new Error(
      `${responseObjectLabel} structured response was not an object.`
    );
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
  field: string,
  responseObjectLabel: string
): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((entry) => {
    const candidate = assertObject(entry, responseObjectLabel);
    return {
      ...candidate,
      [field]: normalizeUnitInterval(candidate[field])
    };
  });
};

const normalizeLiveStateCandidate = (
  value: unknown,
  responseObjectLabel: string
): unknown => {
  const candidate = assertObject(value, responseObjectLabel);
  const livePredictions = assertObject(
    candidate.live_predictions,
    responseObjectLabel
  );
  const verification = assertObject(
    candidate.verification,
    responseObjectLabel
  );

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
        "probability",
        responseObjectLabel
      ),
      win_probability_changes: normalizeProbabilityEntryArray(
        livePredictions.win_probability_changes,
        "last_interval",
        responseObjectLabel
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

const normalizeUpcomingEventCandidate = (
  value: unknown,
  responseObjectLabel: string
): unknown => {
  const candidate = assertObject(value, responseObjectLabel);
  const intelligence = assertObject(
    candidate.upcoming_intelligence,
    responseObjectLabel
  );

  return {
    ...candidate,
    upcoming_intelligence: {
      ...intelligence,
      win_probabilities: normalizeProbabilityEntryArray(
        intelligence.win_probabilities,
        "probability",
        responseObjectLabel
      )
    }
  };
};

const normalizeLiveEventCandidate = (
  value: unknown,
  responseObjectLabel: string
): unknown => {
  const candidate = assertObject(value, responseObjectLabel);

  return {
    ...candidate,
    live_state: normalizeLiveStateCandidate(
      candidate.live_state,
      responseObjectLabel
    )
  };
};

export const regionToApproximateUserLocation = (
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

export type StructuredSearchProviderFlavor = {
  buildSearchRequest(
    region: string
  ): Pick<StructuredResponseRequest, "tools" | "toolChoice" | "include">;
  getProviderDebug(payload: Record<string, unknown>): ProviderDebugInfo;
  wasSearchInvoked(providerDebug: ProviderDebugInfo): boolean;
  missingSearchWarning: string;
  missingSearchFailureCode: string;
  responseObjectLabel: string;
  allowUngroundedResults?: boolean;
};

const buildMissingSearchWarnings = (
  baseWarning: string,
  providerDebug: ProviderDebugInfo
): string[] => {
  const warnings = [baseWarning];
  const geminiDebug = providerDebug.gemini_google_search;

  if (geminiDebug?.finish_reason) {
    warnings.push(`Gemini finish reason: ${geminiDebug.finish_reason}`);
  }

  if (geminiDebug?.response_preview) {
    warnings.push(`Gemini response preview: ${geminiDebug.response_preview}`);
  }

  return warnings;
};

const buildPayloadWarnings = (payload: Record<string, unknown>): string[] =>
  Array.isArray(payload.warnings)
    ? payload.warnings.map((warning) => String(warning))
    : [];

const buildWarningsWithOptionalMissingSearch = (
  payload: Record<string, unknown>,
  providerDebug: ProviderDebugInfo,
  flavor: StructuredSearchProviderFlavor
): string[] => {
  const warnings = buildPayloadWarnings(payload);

  if (!flavor.wasSearchInvoked(providerDebug) && flavor.allowUngroundedResults) {
    warnings.unshift(
      ...buildMissingSearchWarnings(flavor.missingSearchWarning, providerDebug)
    );
  }

  return warnings;
};

const withResultFilteringDebug = (
  providerDebug: ProviderDebugInfo,
  summary: ProviderDebugInfo["result_filtering"]
): ProviderDebugInfo => ({
  ...providerDebug,
  result_filtering: summary
});

export class StructuredSearchLiveEventDiscoveryProvider implements LiveEventDiscoveryProvider {
  constructor(
    private readonly transport: StructuredResponseTransport,
    private readonly flavor: StructuredSearchProviderFlavor
  ) {}

  async discover(input: DiscoverRequest) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildDiscoveryPrompt(input),
        ...this.flavor.buildSearchRequest(input.region),
        schema: openAiSchemas.discovery
      }),
      this.flavor.responseObjectLabel
    );
    const providerDebug = this.flavor.getProviderDebug(payload);
    if (
      !this.flavor.wasSearchInvoked(providerDebug) &&
      !this.flavor.allowUngroundedResults
    ) {
      return {
        events: [],
        warnings: buildMissingSearchWarnings(
          this.flavor.missingSearchWarning,
          providerDebug
        ),
        provider_debug: providerDebug
      };
    }

    const warnings = buildWarningsWithOptionalMissingSearch(
      payload,
      providerDebug,
      this.flavor
    );

    const rawEvents = Array.isArray(payload.events)
      ? payload.events.map((event) =>
          liveEventSchema.parse(
            normalizeLiveEventCandidate(event, this.flavor.responseObjectLabel)
          )
        )
      : [];

    const acceptedEvents: LiveEvent[] = [];
    const rejectedEvents: NonNullable<
      ProviderDebugInfo["result_filtering"]
    >["rejected_events"] = [];
    for (const event of rawEvents) {
      if (!matchesRequestedSport(input.sport, event.context?.match.sport)) {
        rejectedEvents.push({
          match_id: event.match_id,
          match_name: event.context?.match.match_name,
          reason: `Filtered out because event sport=${event.context?.match.sport ?? "unknown"} did not match requested sport=${input.sport}.`
        });
        continue;
      }

      const quality = assessLiveEventQuality(event);
      if (quality.accepted) {
        acceptedEvents.push(event);
        continue;
      }
      rejectedEvents.push({
        match_id: event.match_id,
        match_name: event.context?.match.match_name,
        reason: quality.reason ?? "Live event did not meet the quality gate."
      });
      warnings.push(
        `${event.context?.match.match_name ?? event.match_id} was excluded from live results: ${quality.reason}`
      );
    }

    return {
      events: acceptedEvents,
      warnings,
      provider_debug: withResultFilteringDebug(providerDebug, {
        raw_event_count: rawEvents.length,
        accepted_event_count: acceptedEvents.length,
        rejected_events: rejectedEvents
      })
    };
  }
}

export class StructuredSearchLiveEventStateProvider implements LiveEventStateProvider {
  constructor(
    private readonly transport: StructuredResponseTransport,
    private readonly flavor: StructuredSearchProviderFlavor
  ) {}

  async refreshStates(input: {
    region: string;
    sport: string;
    matches: MatchIdentity[];
  }) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildStateRefreshPrompt(input),
        ...this.flavor.buildSearchRequest(input.region),
        schema: openAiSchemas.stateRefresh
      }),
      this.flavor.responseObjectLabel
    );
    const providerDebug = this.flavor.getProviderDebug(payload);
    if (
      !this.flavor.wasSearchInvoked(providerDebug) &&
      !this.flavor.allowUngroundedResults
    ) {
      return {
        states: [],
        failed_matches: input.matches.map((match) => ({
          match_id: match.match_id,
          code: this.flavor.missingSearchFailureCode,
          message: this.flavor.missingSearchWarning
        })),
        warnings: buildMissingSearchWarnings(
          this.flavor.missingSearchWarning,
          providerDebug
        ),
        provider_debug: providerDebug
      };
    }

    const warnings = buildWarningsWithOptionalMissingSearch(
      payload,
      providerDebug,
      this.flavor
    );

    const states = Array.isArray(payload.states)
      ? payload.states.map((state) =>
          liveStateSchema.parse(
            normalizeLiveStateCandidate(state, this.flavor.responseObjectLabel)
          )
        )
      : [];
    const failedMatches = Array.isArray(payload.failed_matches)
      ? payload.failed_matches.map((item) => {
          const candidate = assertObject(item, this.flavor.responseObjectLabel);
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

export class StructuredSearchLiveEventLookupProvider implements LiveEventLookupProvider {
  constructor(
    private readonly transport: StructuredResponseTransport,
    private readonly flavor: StructuredSearchProviderFlavor
  ) {}

  async getContext(matchId: string): Promise<MatchContext | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildContextLookupPrompt(matchId),
        ...this.flavor.buildSearchRequest("global"),
        schema: openAiSchemas.contextLookup
      }),
      this.flavor.responseObjectLabel
    );
    if (
      !this.flavor.wasSearchInvoked(this.flavor.getProviderDebug(payload)) &&
      !this.flavor.allowUngroundedResults
    ) {
      return null;
    }
    return payload.context ? matchContextSchema.parse(payload.context) : null;
  }

  async getState(matchId: string): Promise<LiveState | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildStateLookupPrompt(matchId),
        ...this.flavor.buildSearchRequest("global"),
        schema: openAiSchemas.stateLookup
      }),
      this.flavor.responseObjectLabel
    );
    if (
      !this.flavor.wasSearchInvoked(this.flavor.getProviderDebug(payload)) &&
      !this.flavor.allowUngroundedResults
    ) {
      return null;
    }
    return payload.live_state
      ? liveStateSchema.parse(
          normalizeLiveStateCandidate(
            payload.live_state,
            this.flavor.responseObjectLabel
          )
        )
      : null;
  }

  async getLiveEvent(matchId: string): Promise<LiveEvent | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildLiveLookupPrompt(matchId),
        ...this.flavor.buildSearchRequest("global"),
        schema: openAiSchemas.liveLookup
      }),
      this.flavor.responseObjectLabel
    );
    if (
      !this.flavor.wasSearchInvoked(this.flavor.getProviderDebug(payload)) &&
      !this.flavor.allowUngroundedResults
    ) {
      return null;
    }
    if (!payload.event) {
      return null;
    }

    const event = liveEventSchema.parse(
      normalizeLiveEventCandidate(
        payload.event,
        this.flavor.responseObjectLabel
      )
    );
    return assessLiveEventQuality(event).accepted ? event : null;
  }
}

export class StructuredSearchUpcomingEventProvider implements UpcomingEventProvider {
  constructor(
    private readonly transport: StructuredResponseTransport,
    private readonly flavor: StructuredSearchProviderFlavor
  ) {}

  async getUpcoming(input: { region: string; sport: string; days: number }) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildUpcomingPrompt(input),
        ...this.flavor.buildSearchRequest(input.region),
        schema: openAiSchemas.upcoming
      }),
      this.flavor.responseObjectLabel
    );
    const providerDebug = this.flavor.getProviderDebug(payload);
    if (
      !this.flavor.wasSearchInvoked(providerDebug) &&
      !this.flavor.allowUngroundedResults
    ) {
      return {
        events: [],
        warnings: buildMissingSearchWarnings(
          this.flavor.missingSearchWarning,
          providerDebug
        ),
        provider_debug: providerDebug
      };
    }

    const rawEvents = Array.isArray(payload.events)
      ? payload.events.map((event) =>
          upcomingEventSchema.parse(
            normalizeUpcomingEventCandidate(event, this.flavor.responseObjectLabel)
          )
        )
      : [];
    const acceptedEvents: UpcomingEvent[] = [];
    const rejectedEvents: NonNullable<
      ProviderDebugInfo["result_filtering"]
    >["rejected_events"] = [];

    for (const event of rawEvents) {
      if (!matchesRequestedSport(input.sport, event.context.match.sport)) {
        rejectedEvents.push({
          match_id: event.match_id,
          match_name: event.context.match.match_name,
          reason: `Filtered out because event sport=${event.context.match.sport} did not match requested sport=${input.sport}.`
        });
        continue;
      }
      acceptedEvents.push(event);
    }

    return {
      events: acceptedEvents,
      warnings: buildWarningsWithOptionalMissingSearch(
        payload,
        providerDebug,
        this.flavor
      ),
      provider_debug: withResultFilteringDebug(providerDebug, {
        raw_event_count: rawEvents.length,
        accepted_event_count: acceptedEvents.length,
        rejected_events: rejectedEvents
      })
    };
  }

  async getUpcomingByMatchId(matchId: string): Promise<UpcomingEvent | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildUpcomingLookupPrompt(matchId),
        ...this.flavor.buildSearchRequest("global"),
        schema: openAiSchemas.upcomingLookup
      }),
      this.flavor.responseObjectLabel
    );
    if (
      !this.flavor.wasSearchInvoked(this.flavor.getProviderDebug(payload)) &&
      !this.flavor.allowUngroundedResults
    ) {
      return null;
    }
    return payload.event
      ? upcomingEventSchema.parse(
          normalizeUpcomingEventCandidate(
            payload.event,
            this.flavor.responseObjectLabel
          )
        )
      : null;
  }
}
