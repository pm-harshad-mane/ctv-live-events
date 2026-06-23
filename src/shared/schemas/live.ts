import { z } from "zod";

const isoDatetimeSchema = z.string().datetime({ offset: true });

export const participantSchema = z.object({
  participant_id: z.string().min(1),
  name: z.string().min(1),
  short_name: z.string().nullable().optional()
});

export const matchIdentitySchema = z.object({
  match_id: z.string().min(1),
  sport: z.string().min(1),
  tournament_name: z.string().min(1),
  scheduled_start_time: isoDatetimeSchema,
  participants: z.array(participantSchema).min(2)
});

export const matchContextSchema = z.object({
  match: z.object({
    match_id: z.string(),
    match_name: z.string(),
    sport: z.string(),
    tournament_name: z.string(),
    tournament_stage: z.string(),
    scheduled_start_time: isoDatetimeSchema,
    venue: z.object({
      stadium: z.string(),
      city: z.string(),
      state: z.string(),
      country: z.string()
    })
  }),
  participants: z.array(
    participantSchema.extend({
      role: z.enum(["home", "away"]),
      ranking: z.string().nullable(),
      recent_form: z.array(z.string())
    })
  ),
  pre_match_intelligence: z.object({
    headline: z.string(),
    summary: z.string(),
    expected_competitiveness: z.number().min(0).max(100),
    key_matchup: z.string()
  }),
  context_version: z.number().int().positive(),
  context_fingerprint: z.string(),
  context_generated_at: isoDatetimeSchema
});

export const liveStateSchema = z.object({
  match_id: z.string(),
  match_status: z.enum([
    "live",
    "paused",
    "suspended",
    "completed",
    "postponed",
    "cancelled",
    "unverified"
  ]),
  period: z.object({
    code: z.string(),
    display: z.string()
  }),
  clock: z.object({
    display: z.string(),
    elapsed_seconds: z.number().nonnegative(),
    remaining_seconds: z.number().nonnegative()
  }),
  score: z.object({
    participant_scores: z.array(
      z.object({
        participant_id: z.string(),
        display_score: z.string(),
        numeric_score: z.number()
      })
    ),
    display: z.string(),
    score_differential: z.number()
  }),
  sport_specific: z.object({
    quarter: z.number().int().nullable().optional(),
    shot_clock_seconds: z.number().int().nullable().optional(),
    foul_pressure: z.string().nullable().optional(),
    phase: z.string().nullable().optional(),
    stoppage_time_minutes: z.number().int().nullable().optional(),
    pressure_side: z.string().nullable().optional(),
    attacking_side: z.string().nullable().optional(),
    possession_team: z.string().nullable().optional(),
    down: z.number().int().nullable().optional(),
    distance_yards: z.number().int().nullable().optional(),
    yard_line: z.string().nullable().optional(),
    red_zone: z.boolean().nullable().optional(),
    inning: z.number().int().nullable().optional(),
    innings_half: z.string().nullable().optional(),
    outs: z.number().int().nullable().optional(),
    balls: z.number().int().nullable().optional(),
    strikes: z.number().int().nullable().optional(),
    runners_on_base: z.array(z.string()).nullable().optional(),
    over: z.number().nullable().optional(),
    wickets: z.number().int().nullable().optional(),
    run_rate: z.number().nullable().optional(),
    target_runs: z.number().int().nullable().optional(),
    power_play: z.boolean().nullable().optional(),
    period_number: z.number().int().nullable().optional(),
    pulled_goalie: z.boolean().nullable().optional(),
    current_set: z.number().int().nullable().optional(),
    set_score: z.string().nullable().optional(),
    serve_side: z.string().nullable().optional(),
    break_point_pressure: z.boolean().nullable().optional(),
    round: z.number().int().nullable().optional(),
    control_time_seconds: z.number().int().nullable().optional(),
    finish_threat: z.string().nullable().optional()
  }),
  current_possession_or_control: z.object({
    participant_id: z.string().nullable(),
    description: z.string()
  }),
  active_players: z.array(
    z.object({
      player_id: z.string(),
      player_name: z.string(),
      participant_id: z.string(),
      role: z.string(),
      status: z.string(),
      impact_summary: z.string(),
      key_metrics: z.array(
        z.object({
          label: z.string(),
          value: z.string()
        })
      )
    })
  ),
  what_is_happening: z.object({
    headline: z.string(),
    summary: z.string(),
    situation_code: z.string(),
    key_entity_ids: z.array(z.string())
  }),
  last_major_event: z.object({
    event_id: z.string(),
    event_type: z.string(),
    participant_id: z.string(),
    player_id: z.string().nullable(),
    description: z.string(),
    match_time: z.string(),
    event_importance: z.number()
  }),
  recent_events: z.array(
    z.object({
      description: z.string(),
      match_time: z.string()
    })
  ),
  special_state: z.object({
    is_timeout: z.boolean(),
    is_under_review: z.boolean(),
    is_injury_delay: z.boolean(),
    is_weather_delay: z.boolean(),
    is_overtime_or_tiebreak: z.boolean(),
    is_paused: z.boolean(),
    is_postponed: z.boolean(),
    is_cancelled: z.boolean(),
    is_suspended: z.boolean(),
    pause_reason: z.string().nullable(),
    status_reason: z.string().nullable()
  }),
  excitement: z.object({
    aggregate_score: z.number(),
    level: z.string(),
    current_excitement: z.number(),
    recent_excitement: z.number(),
    expected_remaining_excitement: z.number(),
    reason_codes: z.array(z.string())
  }),
  criticality: z.object({
    score: z.number(),
    level: z.string(),
    reason_codes: z.array(z.string())
  }),
  competitive_balance: z.object({
    score: z.number(),
    level: z.string()
  }),
  watchability: z
    .object({
      current_score: z.number().min(0).max(100),
      tension_score: z.number().min(0).max(100),
      scoring_imminence_score: z.number().min(0).max(100),
      swing_potential_score: z.number().min(0).max(100),
      state_clarity_score: z.number().min(0).max(100),
      evidence_strength_score: z.number().min(0).max(100)
    })
    .default({
      current_score: 50,
      tension_score: 50,
      scoring_imminence_score: 50,
      swing_potential_score: 50,
      state_clarity_score: 50,
      evidence_strength_score: 50
    }),
  cross_phase_scores: z
    .object({
      stakes_score: z.number().min(0).max(100),
      star_power_score: z.number().min(0).max(100),
      upset_potential_score: z.number().min(0).max(100),
      narrative_strength_score: z.number().min(0).max(100)
    })
    .default({
      stakes_score: 50,
      star_power_score: 50,
      upset_potential_score: 50,
      narrative_strength_score: 50
    }),
  momentum: z.object({
    leading_participant_id: z.string(),
    score: z.number(),
    direction: z.string(),
    summary: z.string(),
    reason_codes: z.array(z.string())
  }),
  live_predictions: z.object({
    win_probabilities: z.array(
      z.object({
        participant_id: z.string(),
        probability: z.number().min(0).max(1)
      })
    ),
    win_probability_changes: z.array(
      z.object({
        participant_id: z.string(),
        last_interval: z.number().min(-1).max(1)
      })
    ),
    comeback_probability: z.number().min(0).max(1),
    upset_probability: z.number().min(0).max(1),
    draw_probability: z.number().min(0).max(1),
    overtime_or_tiebreak_probability: z.number().min(0).max(1),
    likely_next_major_event: z.string(),
    expected_remaining_duration_minutes: z.number(),
    prediction_confidence: z.number().min(0).max(1)
  }),
  summary: z.object({
    headline: z.string(),
    short_byte: z.string(),
    key_points: z.array(z.string())
  }),
  freshness: z.object({
    generated_at: isoDatetimeSchema,
    source_observation_time: isoDatetimeSchema.nullable(),
    age_seconds: z.number().nonnegative()
  }),
  verification: z.object({
    status: z.enum([
      "verified",
      "partially_verified",
      "unverified",
      "conflicting_sources"
    ]),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string())
  })
});

export const liveEventSchema = z.object({
  match_id: z.string(),
  context_status: z.enum(["new", "unchanged", "updated", "unavailable"]),
  context_fingerprint: z.string(),
  context: matchContextSchema.nullable(),
  live_state: liveStateSchema,
  freshness: z.object({
    context_generated_at: isoDatetimeSchema.nullable(),
    state_generated_at: isoDatetimeSchema,
    context_age_seconds: z.number().nullable(),
    state_age_seconds: z.number()
  })
});

export const requestOriginSchema = z.enum([
  "live_page",
  "tracker",
  "upcoming_page",
  "unknown"
]);

export const discoverRequestSchema = z.object({
  region: z.string().default("north-america"),
  sport: z.string().default("all"),
  include_context: z.boolean().default(true),
  request_origin: requestOriginSchema.default("unknown"),
  known_matches: z
    .array(
      z.object({
        match_id: z.string(),
        context_fingerprint: z.string()
      })
    )
    .default([])
});

export const stateRefreshRequestSchema = z.object({
  region: z.string().default("north-america"),
  sport: z.string().default("all"),
  request_origin: requestOriginSchema.default("unknown"),
  matches: z.array(matchIdentitySchema).max(50)
});

export const upcomingIntelligenceSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  projected_competitiveness: z.number().min(0).max(100),
  watch_reasons: z.array(z.string()),
  cross_phase_scores: z
    .object({
      stakes_score: z.number().min(0).max(100),
      star_power_score: z.number().min(0).max(100),
      upset_potential_score: z.number().min(0).max(100),
      narrative_strength_score: z.number().min(0).max(100)
    })
    .default({
      stakes_score: 50,
      star_power_score: 50,
      upset_potential_score: 50,
      narrative_strength_score: 50
    }),
  audience_signals: z
    .object({
      audience_interest_score: z.number().min(0).max(100),
      stakes_score: z.number().min(0).max(100),
      star_power_score: z.number().min(0).max(100),
      volatility_score: z.number().min(0).max(100),
      upset_potential_score: z.number().min(0).max(100),
      narrative_strength_score: z.number().min(0).max(100)
    })
    .default({
      audience_interest_score: 50,
      stakes_score: 50,
      star_power_score: 50,
      volatility_score: 50,
      upset_potential_score: 50,
      narrative_strength_score: 50
    }),
  win_probabilities: z.array(
    z.object({
      participant_id: z.string(),
      probability: z.number().min(0).max(1)
    })
  )
});

export const upcomingEventSchema = z.object({
  match_id: z.string(),
  context: matchContextSchema,
  upcoming_intelligence: upcomingIntelligenceSchema,
  freshness: z.object({
    generated_at: isoDatetimeSchema,
    age_seconds: z.number().nonnegative()
  })
});

export const upcomingQuerySchema = z.object({
  region: z.string().default("north-america"),
  sport: z.string().default("all"),
  request_origin: requestOriginSchema.default("unknown"),
  days: z.number().int().positive().max(30).default(7)
});

export const providerModeSchema = z.enum(["mock", "openai", "gemini"]);

export const providerOptionSchema = z.object({
  id: providerModeSchema,
  label: z.string().min(1)
});

export const configSchema = z.object({
  api_version: z.literal("v1"),
  ai_service_available: z.boolean(),
  discovery_refresh_after_seconds: z.number().int().positive(),
  state_refresh_after_seconds: z.number().int().positive(),
  active_model_request_timeout_ms: z.number().int().positive(),
  max_live_events: z.number().int().positive(),
  public_api_access: z.boolean(),
  use_mock_data: z.boolean(),
  active_model: providerModeSchema,
  available_models: z.array(providerOptionSchema).min(1)
});

export const trackerHistoryPointSchema = z.object({
  capturedAt: isoDatetimeSchema,
  liveState: liveStateSchema
});

export const trackerArchiveSummarySchema = z.object({
  archive_id: z.string().min(1),
  archived_at: isoDatetimeSchema,
  match_id: z.string().min(1),
  match_name: z.string().min(1),
  sport: z.string().min(1),
  tournament_name: z.string().min(1),
  scheduled_start_time: isoDatetimeSchema,
  venue_summary: z.string().min(1),
  final_status: z.string().min(1),
  final_score_display: z.string().min(1),
  history_points: z.number().int().nonnegative()
});

export const trackerArchiveSchema = z.object({
  summary: trackerArchiveSummarySchema,
  event: liveEventSchema,
  history: z.array(trackerHistoryPointSchema).min(1)
});

export const trackerArchiveCreateSchema = z.object({
  event: liveEventSchema,
  history: z.array(trackerHistoryPointSchema).min(1)
});

export type Participant = z.infer<typeof participantSchema>;
export type MatchIdentity = z.infer<typeof matchIdentitySchema>;
export type MatchContext = z.infer<typeof matchContextSchema>;
export type LiveState = z.infer<typeof liveStateSchema>;
export type LiveEvent = z.infer<typeof liveEventSchema>;
export type DiscoverRequestInput = z.input<typeof discoverRequestSchema>;
export type DiscoverRequest = z.infer<typeof discoverRequestSchema>;
export type StateRefreshRequestInput = z.input<typeof stateRefreshRequestSchema>;
export type StateRefreshRequest = z.infer<typeof stateRefreshRequestSchema>;
export type UpcomingEvent = z.infer<typeof upcomingEventSchema>;
export type UpcomingQueryInput = z.input<typeof upcomingQuerySchema>;
export type UpcomingQuery = z.infer<typeof upcomingQuerySchema>;
export type PublicConfig = z.infer<typeof configSchema>;
export type ProviderMode = z.infer<typeof providerModeSchema>;
export type ProviderOption = z.infer<typeof providerOptionSchema>;
export type RequestOrigin = z.infer<typeof requestOriginSchema>;
export type TrackerHistoryPoint = z.infer<typeof trackerHistoryPointSchema>;
export type TrackerArchiveSummary = z.infer<typeof trackerArchiveSummarySchema>;
export type TrackerArchive = z.infer<typeof trackerArchiveSchema>;
export type TrackerArchiveCreateInput = z.infer<typeof trackerArchiveCreateSchema>;
