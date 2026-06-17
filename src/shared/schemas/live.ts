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
  match_status: z.enum(["live", "completed", "unverified"]),
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
    pressure_side: z.string().nullable().optional()
  }),
  current_possession_or_control: z.object({
    participant_id: z.string().nullable(),
    description: z.string()
  }),
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
    is_overtime_or_tiebreak: z.boolean()
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

export const discoverRequestSchema = z.object({
  region: z.string().default("north-america"),
  sport: z.string().default("all"),
  include_context: z.boolean().default(true),
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
  matches: z.array(matchIdentitySchema).max(50)
});

export const upcomingIntelligenceSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  projected_competitiveness: z.number().min(0).max(100),
  watch_reasons: z.array(z.string()),
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
  days: z.number().int().positive().max(30).default(7)
});

export const configSchema = z.object({
  api_version: z.literal("v1"),
  ai_service_available: z.boolean(),
  discovery_refresh_after_seconds: z.number().int().positive(),
  state_refresh_after_seconds: z.number().int().positive(),
  max_live_events: z.number().int().positive(),
  public_api_access: z.boolean()
});

export type Participant = z.infer<typeof participantSchema>;
export type MatchIdentity = z.infer<typeof matchIdentitySchema>;
export type MatchContext = z.infer<typeof matchContextSchema>;
export type LiveState = z.infer<typeof liveStateSchema>;
export type LiveEvent = z.infer<typeof liveEventSchema>;
export type DiscoverRequest = z.infer<typeof discoverRequestSchema>;
export type StateRefreshRequest = z.infer<typeof stateRefreshRequestSchema>;
export type UpcomingEvent = z.infer<typeof upcomingEventSchema>;
export type UpcomingQuery = z.infer<typeof upcomingQuerySchema>;
export type PublicConfig = z.infer<typeof configSchema>;
