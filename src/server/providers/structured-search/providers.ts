import type {
  DiscoverRequest,
  DiscoverRequestInput,
  LiveEvent,
  LiveState,
  MatchContext,
  MatchIdentity,
  SourceReference,
  UpcomingQueryInput,
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
} from "../../structured-output/prompts";
import { structuredOutputSchemas } from "../../structured-output/schemas";
import type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../../structured-output/types";
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

const isClearlyPreMatchState = (
  state: LiveState,
  context: MatchContext | null
): boolean => {
  const headline = state.what_is_happening.headline.toLowerCase();
  const summary = state.what_is_happening.summary.toLowerCase();
  const shortByte = state.summary.short_byte.toLowerCase();
  const text = `${headline} ${summary} ${shortByte}`;

  const preMatchLanguage =
    text.includes("has not yet started") ||
    text.includes("scheduled to begin") ||
    text.includes("match scheduled") ||
    text.includes("upcoming match") ||
    state.what_is_happening.situation_code === "pre_match";

  const kickoffPlaceholderClock =
    state.clock.elapsed_seconds === 0 &&
    state.clock.display === "00:00" &&
    state.clock.remaining_seconds >= 3600;

  const zeroScore =
    state.score.participant_scores.every(
      (participant) => participant.numeric_score === 0
    ) && state.score.score_differential === 0;

  const scheduledStartTime = context?.match.scheduled_start_time
    ? Date.parse(context.match.scheduled_start_time)
    : Number.NaN;
  const scheduledInFuture =
    Number.isFinite(scheduledStartTime) && scheduledStartTime > Date.now();

  return (
    preMatchLanguage || (kickoffPlaceholderClock && zeroScore) || scheduledInFuture
  );
};

const assessLiveStateQuality = (
  state: LiveState,
  context: MatchContext | null
): { accepted: boolean; reason?: string } => {
  if (isClearlyPreMatchState(state, context)) {
    return {
      accepted: false,
      reason:
        "Provider returned a pre-match or future-kickoff state for the live endpoint."
    };
  }

  if (!["live", "paused", "suspended"].includes(state.match_status)) {
    return {
      accepted: false,
      reason: `Match was not verified as currently live (status=${state.match_status}).`
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

  const stateQuality = assessLiveStateQuality(event.live_state, event.context);
  if (!stateQuality.accepted) {
    return stateQuality;
  }

  if (event.context.participants.length < 2) {
    return {
      accepted: false,
      reason: "Participant details were incomplete for this live match."
    };
  }

  return stateQuality;
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

const optionalObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

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

const normalizeHundredPointScore = (value: unknown): unknown => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  if (value >= 0 && value <= 1) {
    return Math.round(value * 100);
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.round(value);
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

const normalizeSourceReference = (value: unknown): SourceReference | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  if (!title) {
    return null;
  }

  return {
    title,
    url: typeof candidate.url === "string" ? candidate.url : null,
    domain: typeof candidate.domain === "string" ? candidate.domain : null,
    provider: typeof candidate.provider === "string" ? candidate.provider : null
  };
};

const dedupeSourceReferences = (
  sources: SourceReference[]
): SourceReference[] => {
  const deduped = new Map<string, SourceReference>();

  for (const source of sources) {
    const key = `${source.title}::${source.url ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, source);
    }
  }

  return Array.from(deduped.values());
};

const normalizeLiveStateCandidate = (
  value: unknown,
  responseObjectLabel: string,
  sources: SourceReference[] = []
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
  const specialState = assertObject(candidate.special_state, responseObjectLabel);
  const excitement = optionalObject(candidate.excitement);
  const criticality = optionalObject(candidate.criticality);
  const competitiveBalance = optionalObject(candidate.competitive_balance);
  const watchability = optionalObject(candidate.watchability);
  const crossPhaseScores = optionalObject(candidate.cross_phase_scores);
  const momentum = optionalObject(candidate.momentum);

  return {
    ...candidate,
    excitement: {
      ...excitement,
      aggregate_score: normalizeHundredPointScore(excitement.aggregate_score ?? 50),
      current_excitement: normalizeHundredPointScore(
        excitement.current_excitement ?? 50
      ),
      recent_excitement: normalizeHundredPointScore(
        excitement.recent_excitement ?? 50
      ),
      expected_remaining_excitement: normalizeHundredPointScore(
        excitement.expected_remaining_excitement ?? 50
      )
    },
    criticality: {
      ...criticality,
      score: normalizeHundredPointScore(criticality.score ?? 50)
    },
    competitive_balance: {
      ...competitiveBalance,
      score: normalizeHundredPointScore(competitiveBalance.score ?? 50)
    },
    watchability: {
      ...watchability,
      current_score: normalizeHundredPointScore(watchability.current_score ?? 50),
      tension_score: normalizeHundredPointScore(watchability.tension_score ?? 50),
      scoring_imminence_score: normalizeHundredPointScore(
        watchability.scoring_imminence_score ?? 50
      ),
      swing_potential_score: normalizeHundredPointScore(
        watchability.swing_potential_score ?? 50
      ),
      state_clarity_score: normalizeHundredPointScore(
        watchability.state_clarity_score ?? 50
      ),
      evidence_strength_score: normalizeHundredPointScore(
        watchability.evidence_strength_score ?? 50
      )
    },
    cross_phase_scores: {
      ...crossPhaseScores,
      stakes_score: normalizeHundredPointScore(crossPhaseScores.stakes_score ?? 50),
      star_power_score: normalizeHundredPointScore(
        crossPhaseScores.star_power_score ?? 50
      ),
      upset_potential_score: normalizeHundredPointScore(
        crossPhaseScores.upset_potential_score ?? 50
      ),
      narrative_strength_score: normalizeHundredPointScore(
        crossPhaseScores.narrative_strength_score ?? 50
      )
    },
    momentum: {
      ...momentum,
      score: normalizeHundredPointScore(momentum.score ?? 50)
    },
    special_state: {
      is_timeout: Boolean(specialState.is_timeout),
      is_under_review: Boolean(specialState.is_under_review),
      is_injury_delay: Boolean(specialState.is_injury_delay),
      is_weather_delay: Boolean(specialState.is_weather_delay),
      is_overtime_or_tiebreak: Boolean(specialState.is_overtime_or_tiebreak),
      is_paused:
        "is_paused" in specialState
          ? Boolean(specialState.is_paused)
          : Boolean(
              specialState.is_timeout ||
                specialState.is_under_review ||
                specialState.is_injury_delay ||
                specialState.is_weather_delay
            ),
      is_postponed: Boolean(specialState.is_postponed),
      is_cancelled: Boolean(specialState.is_cancelled),
      is_suspended: Boolean(specialState.is_suspended),
      pause_reason:
        typeof specialState.pause_reason === "string"
          ? specialState.pause_reason
          : null,
      status_reason:
        typeof specialState.status_reason === "string"
          ? specialState.status_reason
          : null
    },
    verification: {
      ...verification,
      confidence: normalizeUnitInterval(verification.confidence)
    },
    sources,
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
  const audienceSignals = optionalObject(intelligence.audience_signals);
  const crossPhaseScores = optionalObject(intelligence.cross_phase_scores);
  const projectedCompetitiveness =
    normalizeHundredPointScore(intelligence.projected_competitiveness ?? 50);

  return {
    ...candidate,
    upcoming_intelligence: {
      ...intelligence,
      projected_competitiveness: projectedCompetitiveness,
      audience_signals: {
        ...audienceSignals,
        audience_interest_score: normalizeHundredPointScore(
          audienceSignals.audience_interest_score ?? 50
        ),
        stakes_score: normalizeHundredPointScore(audienceSignals.stakes_score ?? 50),
        star_power_score: normalizeHundredPointScore(
          audienceSignals.star_power_score ?? 50
        ),
        volatility_score: normalizeHundredPointScore(
          audienceSignals.volatility_score ?? 50
        ),
        upset_potential_score: normalizeHundredPointScore(
          audienceSignals.upset_potential_score ?? 50
        ),
        narrative_strength_score: normalizeHundredPointScore(
          audienceSignals.narrative_strength_score ?? 50
        )
      },
      cross_phase_scores: {
        ...crossPhaseScores,
        stakes_score: normalizeHundredPointScore(
          crossPhaseScores.stakes_score ?? audienceSignals.stakes_score ?? 50
        ),
        star_power_score: normalizeHundredPointScore(
          crossPhaseScores.star_power_score ?? audienceSignals.star_power_score ?? 50
        ),
        upset_potential_score: normalizeHundredPointScore(
          crossPhaseScores.upset_potential_score ??
            audienceSignals.upset_potential_score ??
            50
        ),
        narrative_strength_score: normalizeHundredPointScore(
          crossPhaseScores.narrative_strength_score ??
            audienceSignals.narrative_strength_score ??
            50
        )
      },
      win_probabilities: normalizeProbabilityEntryArray(
        intelligence.win_probabilities,
        "probability",
        responseObjectLabel
      )
    }
  };
};

const splitMatchNameParticipants = (matchName: unknown): string[] => {
  if (typeof matchName !== "string") {
    return [];
  }

  return matchName
    .split(/\s+vs\.?\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const repairLiveEventContextParticipants = (
  candidate: Record<string, unknown>
): Record<string, unknown> => {
  const context = optionalObject(candidate.context);
  const match = optionalObject(context.match);
  const participants = Array.isArray(context.participants)
    ? context.participants.map((participant) => optionalObject(participant))
    : [];
  const liveState = optionalObject(candidate.live_state);
  const score = optionalObject(liveState.score);
  const participantScores = Array.isArray(score.participant_scores)
    ? score.participant_scores.map((entry) => optionalObject(entry))
    : [];

  if (participants.length >= 2 || participantScores.length < 2) {
    return candidate;
  }

  const nameParts = splitMatchNameParticipants(match.match_name);
  const repairedParticipants = participantScores.slice(0, 2).map((entry, index) => {
    const existing = participants[index] ?? {};
    const role = index === 0 ? "home" : "away";
    const fallbackName = nameParts[index] ?? String(entry.participant_id ?? role);

    return {
      participant_id: String(
        existing.participant_id ?? entry.participant_id ?? `${role}-${index + 1}`
      ),
      name: String(existing.name ?? fallbackName),
      short_name:
        existing.short_name === null || typeof existing.short_name === "string"
          ? existing.short_name
          : null,
      role,
      ranking:
        existing.ranking === null || typeof existing.ranking === "string"
          ? existing.ranking
          : null,
      recent_form: Array.isArray(existing.recent_form)
        ? existing.recent_form.map((value) => String(value))
        : []
    };
  });

  return {
    ...candidate,
    context: {
      ...context,
      participants: repairedParticipants
    }
  };
};

const normalizeLiveEventCandidate = (
  value: unknown,
  responseObjectLabel: string,
  sources: SourceReference[] = []
): unknown => {
  const candidate = repairLiveEventContextParticipants(
    assertObject(value, responseObjectLabel)
  );

  return {
    ...candidate,
    live_state: normalizeLiveStateCandidate(
      candidate.live_state,
      responseObjectLabel,
      sources
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
  getSources(payload: Record<string, unknown>): SourceReference[];
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

const compareScheduledStartAscending = (
  left: { context: { match: { scheduled_start_time: string } } },
  right: { context: { match: { scheduled_start_time: string } } }
): number =>
  new Date(left.context.match.scheduled_start_time).getTime() -
  new Date(right.context.match.scheduled_start_time).getTime();

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

  private async fetchDiscoveryPayload(
    input: DiscoverRequest,
    mode: "default" | "live_recheck" = "default"
  ) {
    return assertObject(
      await this.transport.createStructuredResponse({
        ...buildDiscoveryPrompt(input, { mode }),
        ...this.flavor.buildSearchRequest(input.region),
        requestOrigin: input.request_origin,
        schema: structuredOutputSchemas.discovery,
        maxOutputTokens: 12000
      }),
      this.flavor.responseObjectLabel
    );
  }

  async discover(input: DiscoverRequestInput) {
    const normalizedInput: DiscoverRequest = {
      region: input.region ?? "north-america",
      sport: input.sport ?? "all",
      include_context: input.include_context ?? true,
      request_origin: input.request_origin ?? "unknown",
      known_matches: input.known_matches ?? []
    };
    let payload = await this.fetchDiscoveryPayload(normalizedInput);
    let providerDebug = this.flavor.getProviderDebug(payload);
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
    const normalizedSources = dedupeSourceReferences(
      this.flavor.getSources(payload)
    );

    let rawEvents = Array.isArray(payload.events)
      ? payload.events.map((event) =>
          liveEventSchema.parse(
            normalizeLiveEventCandidate(
              event,
              this.flavor.responseObjectLabel,
              normalizedSources
            )
          )
        )
      : [];

    if (rawEvents.length === 0) {
      const retryPayload = await this.fetchDiscoveryPayload(
        normalizedInput,
        "live_recheck"
      );
      const retryProviderDebug = this.flavor.getProviderDebug(retryPayload);
      if (
        this.flavor.wasSearchInvoked(retryProviderDebug) ||
        this.flavor.allowUngroundedResults
      ) {
        payload = retryPayload;
        providerDebug = retryProviderDebug;
        rawEvents = Array.isArray(retryPayload.events)
          ? retryPayload.events.map((event) =>
              liveEventSchema.parse(
                normalizeLiveEventCandidate(
                  event,
                  this.flavor.responseObjectLabel,
                  dedupeSourceReferences(this.flavor.getSources(retryPayload))
                )
              )
            )
          : [];
        warnings.unshift(
          "Live discovery returned no raw events on the first pass, so a second-pass live recheck was attempted."
        );
        warnings.push(...buildPayloadWarnings(retryPayload));
      }
    }

    const acceptedEvents: LiveEvent[] = [];
    const rejectedEvents: NonNullable<
      ProviderDebugInfo["result_filtering"]
    >["rejected_events"] = [];
    for (const event of rawEvents) {
      if (
        !matchesRequestedSport(
          normalizedInput.sport,
          event.context?.match.sport
        )
      ) {
        rejectedEvents.push({
          match_id: event.match_id,
          match_name: event.context?.match.match_name,
          reason: `Filtered out because event sport=${event.context?.match.sport ?? "unknown"} did not match requested sport=${normalizedInput.sport}.`
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
    request_origin?: "live_page" | "tracker" | "upcoming_page" | "unknown";
    matches: MatchIdentity[];
  }) {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildStateRefreshPrompt(input),
        ...this.flavor.buildSearchRequest(input.region),
        requestOrigin: input.request_origin,
        schema: structuredOutputSchemas.stateRefresh,
        maxOutputTokens: 8000
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
    const normalizedSources = dedupeSourceReferences(
      this.flavor.getSources(payload)
    );

    const states = Array.isArray(payload.states)
      ? payload.states.map((state) =>
          liveStateSchema.parse(
            normalizeLiveStateCandidate(
              state,
              this.flavor.responseObjectLabel,
              normalizedSources
            )
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
      const quality = assessLiveStateQuality(state, null);
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
        schema: structuredOutputSchemas.contextLookup
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
        schema: structuredOutputSchemas.stateLookup,
        maxOutputTokens: 8000
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
            this.flavor.responseObjectLabel,
            dedupeSourceReferences(this.flavor.getSources(payload))
          )
        )
      : null;
  }

  async getLiveEvent(matchId: string): Promise<LiveEvent | null> {
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildLiveLookupPrompt(matchId),
        ...this.flavor.buildSearchRequest("global"),
        schema: structuredOutputSchemas.liveLookup,
        maxOutputTokens: 12000
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
        this.flavor.responseObjectLabel,
        dedupeSourceReferences(this.flavor.getSources(payload))
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

  async getUpcoming(input: UpcomingQueryInput) {
    const normalizedInput = {
      region: input.region ?? "north-america",
      sport: input.sport ?? "all",
      days: input.days ?? 7,
      request_origin: input.request_origin ?? "unknown"
    };
    const payload = assertObject(
      await this.transport.createStructuredResponse({
        ...buildUpcomingPrompt(normalizedInput),
        ...this.flavor.buildSearchRequest(normalizedInput.region),
        requestOrigin: normalizedInput.request_origin,
        schema: structuredOutputSchemas.upcoming
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
      if (
        !matchesRequestedSport(
          normalizedInput.sport,
          event.context.match.sport
        )
      ) {
        rejectedEvents.push({
          match_id: event.match_id,
          match_name: event.context.match.match_name,
          reason: `Filtered out because event sport=${event.context.match.sport} did not match requested sport=${normalizedInput.sport}.`
        });
        continue;
      }
      acceptedEvents.push(event);
    }

    return {
      events: acceptedEvents.sort(compareScheduledStartAscending),
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
        schema: structuredOutputSchemas.upcomingLookup
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
