import type {
  DiscoverRequest,
  MatchIdentity,
  UpcomingQuery
} from "../../shared/schemas/live";

const stringSchema = { type: "string" } as const;
const numberSchema = { type: "number" } as const;

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> => ({
  type: "object",
  properties,
  required,
  additionalProperties: false
});

const arraySchema = (
  items: Record<string, unknown>
): Record<string, unknown> => ({
  type: "array",
  items
});

const nullable = (
  schema: Record<string, unknown>
): Record<string, unknown> => ({
  anyOf: [schema, { type: "null" }]
});

const contextParticipantSchema = objectSchema(
  {
    participant_id: stringSchema,
    name: stringSchema,
    short_name: nullable(stringSchema),
    role: { type: "string", enum: ["home", "away"] },
    ranking: nullable(stringSchema),
    recent_form: arraySchema(stringSchema)
  },
  ["participant_id", "name", "short_name", "role", "ranking", "recent_form"]
);

const matchContextSchema = objectSchema(
  {
    match: objectSchema(
      {
        match_id: stringSchema,
        match_name: stringSchema,
        sport: stringSchema,
        tournament_name: stringSchema,
        tournament_stage: stringSchema,
        scheduled_start_time: stringSchema,
        venue: objectSchema(
          {
            stadium: stringSchema,
            city: stringSchema,
            state: stringSchema,
            country: stringSchema
          },
          ["stadium", "city", "state", "country"]
        )
      },
      [
        "match_id",
        "match_name",
        "sport",
        "tournament_name",
        "tournament_stage",
        "scheduled_start_time",
        "venue"
      ]
    ),
    participants: arraySchema(contextParticipantSchema),
    pre_match_intelligence: objectSchema(
      {
        headline: stringSchema,
        summary: stringSchema,
        expected_competitiveness: numberSchema,
        key_matchup: stringSchema
      },
      ["headline", "summary", "expected_competitiveness", "key_matchup"]
    ),
    context_version: { type: "integer" },
    context_fingerprint: stringSchema,
    context_generated_at: stringSchema
  },
  [
    "match",
    "participants",
    "pre_match_intelligence",
    "context_version",
    "context_fingerprint",
    "context_generated_at"
  ]
);

const verificationSchema = objectSchema(
  {
    status: {
      type: "string",
      enum: [
        "verified",
        "partially_verified",
        "unverified",
        "conflicting_sources"
      ]
    },
    confidence: numberSchema,
    warnings: arraySchema(stringSchema)
  },
  ["status", "confidence", "warnings"]
);

const sportSpecificSchema = objectSchema(
  {
    quarter: nullable({ type: "integer" }),
    shot_clock_seconds: nullable({ type: "integer" }),
    foul_pressure: nullable(stringSchema),
    phase: nullable(stringSchema),
    stoppage_time_minutes: nullable({ type: "integer" }),
    pressure_side: nullable(stringSchema),
    attacking_side: nullable(stringSchema),
    possession_team: nullable(stringSchema),
    down: nullable({ type: "integer" }),
    distance_yards: nullable({ type: "integer" }),
    yard_line: nullable(stringSchema),
    red_zone: nullable({ type: "boolean" }),
    inning: nullable({ type: "integer" }),
    innings_half: nullable(stringSchema),
    outs: nullable({ type: "integer" }),
    balls: nullable({ type: "integer" }),
    strikes: nullable({ type: "integer" }),
    runners_on_base: nullable(arraySchema(stringSchema)),
    over: nullable(numberSchema),
    wickets: nullable({ type: "integer" }),
    run_rate: nullable(numberSchema),
    target_runs: nullable({ type: "integer" }),
    power_play: nullable({ type: "boolean" }),
    period_number: nullable({ type: "integer" }),
    pulled_goalie: nullable({ type: "boolean" }),
    current_set: nullable({ type: "integer" }),
    set_score: nullable(stringSchema),
    serve_side: nullable(stringSchema),
    break_point_pressure: nullable({ type: "boolean" }),
    round: nullable({ type: "integer" }),
    control_time_seconds: nullable({ type: "integer" }),
    finish_threat: nullable(stringSchema)
  },
  [
    "quarter",
    "shot_clock_seconds",
    "foul_pressure",
    "phase",
    "stoppage_time_minutes",
    "pressure_side",
    "attacking_side",
    "possession_team",
    "down",
    "distance_yards",
    "yard_line",
    "red_zone",
    "inning",
    "innings_half",
    "outs",
    "balls",
    "strikes",
    "runners_on_base",
    "over",
    "wickets",
    "run_rate",
    "target_runs",
    "power_play",
    "period_number",
    "pulled_goalie",
    "current_set",
    "set_score",
    "serve_side",
    "break_point_pressure",
    "round",
    "control_time_seconds",
    "finish_threat"
  ]
);

const liveStateSchema = objectSchema(
  {
    match_id: stringSchema,
    match_status: {
      type: "string",
      enum: ["live", "completed", "unverified"]
    },
    period: objectSchema(
      {
        code: stringSchema,
        display: stringSchema
      },
      ["code", "display"]
    ),
    clock: objectSchema(
      {
        display: stringSchema,
        elapsed_seconds: numberSchema,
        remaining_seconds: numberSchema
      },
      ["display", "elapsed_seconds", "remaining_seconds"]
    ),
    score: objectSchema(
      {
        participant_scores: arraySchema(
          objectSchema(
            {
              participant_id: stringSchema,
              display_score: stringSchema,
              numeric_score: numberSchema
            },
            ["participant_id", "display_score", "numeric_score"]
          )
        ),
        display: stringSchema,
        score_differential: numberSchema
      },
      ["participant_scores", "display", "score_differential"]
    ),
    sport_specific: sportSpecificSchema,
    current_possession_or_control: objectSchema(
      {
        participant_id: nullable(stringSchema),
        description: stringSchema
      },
      ["participant_id", "description"]
    ),
    what_is_happening: objectSchema(
      {
        headline: stringSchema,
        summary: stringSchema,
        situation_code: stringSchema,
        key_entity_ids: arraySchema(stringSchema)
      },
      ["headline", "summary", "situation_code", "key_entity_ids"]
    ),
    last_major_event: objectSchema(
      {
        event_id: stringSchema,
        event_type: stringSchema,
        participant_id: stringSchema,
        player_id: nullable(stringSchema),
        description: stringSchema,
        match_time: stringSchema,
        event_importance: numberSchema
      },
      [
        "event_id",
        "event_type",
        "participant_id",
        "player_id",
        "description",
        "match_time",
        "event_importance"
      ]
    ),
    recent_events: arraySchema(
      objectSchema(
        {
          description: stringSchema,
          match_time: stringSchema
        },
        ["description", "match_time"]
      )
    ),
    special_state: objectSchema(
      {
        is_timeout: { type: "boolean" },
        is_under_review: { type: "boolean" },
        is_injury_delay: { type: "boolean" },
        is_weather_delay: { type: "boolean" },
        is_overtime_or_tiebreak: { type: "boolean" }
      },
      [
        "is_timeout",
        "is_under_review",
        "is_injury_delay",
        "is_weather_delay",
        "is_overtime_or_tiebreak"
      ]
    ),
    excitement: objectSchema(
      {
        aggregate_score: numberSchema,
        level: stringSchema,
        current_excitement: numberSchema,
        recent_excitement: numberSchema,
        expected_remaining_excitement: numberSchema,
        reason_codes: arraySchema(stringSchema)
      },
      [
        "aggregate_score",
        "level",
        "current_excitement",
        "recent_excitement",
        "expected_remaining_excitement",
        "reason_codes"
      ]
    ),
    criticality: objectSchema(
      {
        score: numberSchema,
        level: stringSchema,
        reason_codes: arraySchema(stringSchema)
      },
      ["score", "level", "reason_codes"]
    ),
    competitive_balance: objectSchema(
      {
        score: numberSchema,
        level: stringSchema
      },
      ["score", "level"]
    ),
    momentum: objectSchema(
      {
        leading_participant_id: stringSchema,
        score: numberSchema,
        direction: stringSchema,
        summary: stringSchema,
        reason_codes: arraySchema(stringSchema)
      },
      [
        "leading_participant_id",
        "score",
        "direction",
        "summary",
        "reason_codes"
      ]
    ),
    live_predictions: objectSchema(
      {
        win_probabilities: arraySchema(
          objectSchema(
            {
              participant_id: stringSchema,
              probability: numberSchema
            },
            ["participant_id", "probability"]
          )
        ),
        win_probability_changes: arraySchema(
          objectSchema(
            {
              participant_id: stringSchema,
              last_interval: numberSchema
            },
            ["participant_id", "last_interval"]
          )
        ),
        comeback_probability: numberSchema,
        upset_probability: numberSchema,
        draw_probability: numberSchema,
        overtime_or_tiebreak_probability: numberSchema,
        likely_next_major_event: stringSchema,
        expected_remaining_duration_minutes: numberSchema,
        prediction_confidence: numberSchema
      },
      [
        "win_probabilities",
        "win_probability_changes",
        "comeback_probability",
        "upset_probability",
        "draw_probability",
        "overtime_or_tiebreak_probability",
        "likely_next_major_event",
        "expected_remaining_duration_minutes",
        "prediction_confidence"
      ]
    ),
    summary: objectSchema(
      {
        headline: stringSchema,
        short_byte: stringSchema,
        key_points: arraySchema(stringSchema)
      },
      ["headline", "short_byte", "key_points"]
    ),
    freshness: objectSchema(
      {
        generated_at: stringSchema,
        source_observation_time: nullable(stringSchema),
        age_seconds: numberSchema
      },
      ["generated_at", "source_observation_time", "age_seconds"]
    ),
    verification: verificationSchema
  },
  [
    "match_id",
    "match_status",
    "period",
    "clock",
    "score",
    "sport_specific",
    "current_possession_or_control",
    "what_is_happening",
    "last_major_event",
    "recent_events",
    "special_state",
    "excitement",
    "criticality",
    "competitive_balance",
    "momentum",
    "live_predictions",
    "summary",
    "freshness",
    "verification"
  ]
);

const liveEventSchema = objectSchema(
  {
    match_id: stringSchema,
    context_status: {
      type: "string",
      enum: ["new", "unchanged", "updated", "unavailable"]
    },
    context_fingerprint: stringSchema,
    context: nullable(matchContextSchema),
    live_state: liveStateSchema,
    freshness: objectSchema(
      {
        context_generated_at: nullable(stringSchema),
        state_generated_at: stringSchema,
        context_age_seconds: nullable(numberSchema),
        state_age_seconds: numberSchema
      },
      [
        "context_generated_at",
        "state_generated_at",
        "context_age_seconds",
        "state_age_seconds"
      ]
    )
  },
  [
    "match_id",
    "context_status",
    "context_fingerprint",
    "context",
    "live_state",
    "freshness"
  ]
);

const upcomingEventSchema = objectSchema(
  {
    match_id: stringSchema,
    context: matchContextSchema,
    upcoming_intelligence: objectSchema(
      {
        headline: stringSchema,
        summary: stringSchema,
        projected_competitiveness: numberSchema,
        watch_reasons: arraySchema(stringSchema),
        win_probabilities: arraySchema(
          objectSchema(
            {
              participant_id: stringSchema,
              probability: numberSchema
            },
            ["participant_id", "probability"]
          )
        )
      },
      [
        "headline",
        "summary",
        "projected_competitiveness",
        "watch_reasons",
        "win_probabilities"
      ]
    ),
    freshness: objectSchema(
      {
        generated_at: stringSchema,
        age_seconds: numberSchema
      },
      ["generated_at", "age_seconds"]
    )
  },
  ["match_id", "context", "upcoming_intelligence", "freshness"]
);

export type StructuredSchemaDefinition = {
  name: string;
  schema: Record<string, unknown>;
};

export const openAiSchemas = {
  discovery: {
    name: "live_discovery_response",
    schema: objectSchema(
      {
        events: arraySchema(liveEventSchema),
        warnings: arraySchema(stringSchema)
      },
      ["events", "warnings"]
    )
  },
  stateRefresh: {
    name: "live_state_refresh_response",
    schema: objectSchema(
      {
        states: arraySchema(liveStateSchema),
        failed_matches: arraySchema(
          objectSchema(
            {
              match_id: stringSchema,
              code: stringSchema,
              message: stringSchema
            },
            ["match_id", "code", "message"]
          )
        ),
        warnings: arraySchema(stringSchema)
      },
      ["states", "failed_matches", "warnings"]
    )
  },
  liveLookup: {
    name: "single_live_event_response",
    schema: objectSchema(
      {
        event: nullable(liveEventSchema)
      },
      ["event"]
    )
  },
  contextLookup: {
    name: "single_context_response",
    schema: objectSchema(
      {
        context: nullable(matchContextSchema)
      },
      ["context"]
    )
  },
  stateLookup: {
    name: "single_state_response",
    schema: objectSchema(
      {
        live_state: nullable(liveStateSchema)
      },
      ["live_state"]
    )
  },
  upcoming: {
    name: "upcoming_events_response",
    schema: objectSchema(
      {
        events: arraySchema(upcomingEventSchema),
        warnings: arraySchema(stringSchema)
      },
      ["events", "warnings"]
    )
  },
  upcomingLookup: {
    name: "single_upcoming_event_response",
    schema: objectSchema(
      {
        event: nullable(upcomingEventSchema)
      },
      ["event"]
    )
  }
} satisfies Record<string, StructuredSchemaDefinition>;

export const renderJsonInput = (
  payload:
    | DiscoverRequest
    | { region: string; sport: string; matches: MatchIdentity[] }
    | UpcomingQuery
    | Record<string, unknown>
): string => JSON.stringify(payload, null, 2);
