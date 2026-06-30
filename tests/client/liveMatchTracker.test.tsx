import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LiveEvent, LiveState } from "../../src/shared/schemas/live";
import { LiveMatchTracker } from "../../src/client/components/LiveMatchTracker";

const buildLiveState = (
  overrides: Partial<LiveState> = {}
): LiveState =>
  ({
    match_id: "soccer:wc:eng-gha",
    match_status: "live",
    period: {
      code: "first_half",
      display: "1st Half"
    },
    clock: {
      display: "12:00",
      elapsed_seconds: 720,
      remaining_seconds: 1980
    },
    score: {
      participant_scores: [
        {
          participant_id: "eng",
          display_score: "1",
          numeric_score: 1
        },
        {
          participant_id: "gha",
          display_score: "0",
          numeric_score: 0
        }
      ],
      display: "1-0",
      score_differential: 1
    },
    sport_specific: {
      quarter: null,
      shot_clock_seconds: null,
      foul_pressure: null,
      phase: "open_play",
      stoppage_time_minutes: 0,
      pressure_side: "eng",
      attacking_side: "eng",
      possession_team: "eng",
      down: null,
      distance_yards: null,
      yard_line: null,
      red_zone: null,
      inning: null,
      innings_half: null,
      outs: null,
      balls: null,
      strikes: null,
      runners_on_base: null,
      over: null,
      ball_in_over: null,
      wickets: null,
      batting_side: null,
      run_rate: null,
      power_play: null,
      server: null,
      returner: null,
      set_number: null,
      game_score: null,
      point_score: null,
      break_point: null,
      round: null,
      control_time_seconds: null,
      knockdowns: null,
      finish_threat: null
    },
    current_possession_or_control: {
      participant_id: "eng",
      description: "England in control"
    },
    active_players: [],
    what_is_happening: {
      headline: "England are in front",
      summary: "England lead Ghana 1-0.",
      situation_code: "open_play",
      key_entity_ids: ["eng", "gha"]
    },
    last_major_event: {
      event_id: "evt_1",
      event_type: "goal",
      participant_id: "eng",
      player_id: "eng-1",
      description: "England scored.",
      match_time: "12:00",
      event_importance: 80
    },
    recent_events: [],
    special_state: {
      is_timeout: false,
      is_under_review: false,
      is_injury_delay: false,
      is_weather_delay: false,
      is_overtime_or_tiebreak: false,
      is_paused: false,
      is_postponed: false,
      is_cancelled: false,
      is_suspended: false,
      pause_reason: null,
      status_reason: null
    },
    excitement: {
      aggregate_score: 70,
      level: "high",
      current_excitement: 68,
      recent_excitement: 66,
      expected_remaining_excitement: 72,
      reason_codes: ["goal_pressure"]
    },
    criticality: {
      score: 74,
      level: "high",
      reason_codes: ["group_stage"]
    },
    competitive_balance: {
      score: 63,
      level: "moderate"
    },
    momentum: {
      leading_participant_id: "eng",
      score: 61,
      direction: "up",
      summary: "England pressing",
      reason_codes: ["attacking_pressure"]
    },
    cross_phase_scores: {
      stakes_score: 82,
      star_power_score: 76,
      upset_potential_score: 34,
      narrative_strength_score: 79
    },
    watchability: {
      current_score: 78,
      tension_score: 72,
      scoring_imminence_score: 59,
      swing_potential_score: 55,
      state_clarity_score: 88,
      evidence_strength_score: 91
    },
    live_predictions: {
      win_probabilities: [
        {
          participant_id: "eng",
          probability: 0.65
        },
        {
          participant_id: "gha",
          probability: 0.12
        }
      ],
      win_probability_changes: [
        {
          participant_id: "eng",
          delta: 0.02
        },
        {
          participant_id: "gha",
          delta: -0.01
        }
      ],
      likely_next_major_event: "England chance",
      comeback_probability: 0.15,
      upset_probability: 0.12,
      draw_probability: 0.23,
      overtime_or_tiebreak_probability: 0,
      expected_remaining_duration_minutes: 55,
      prediction_confidence: 0.78
    },
    summary: {
      headline: "England vs Ghana",
      short_byte: "England lead.",
      key_points: ["England lead 1-0."]
    },
    verification: {
      confidence: 0.95,
      level: "high"
    },
    freshness: {
      generated_at: "2026-06-23T20:12:00.000Z",
      source_observation_time: "2026-06-23T20:12:00.000Z",
      age_seconds: 3
    },
    sources: [],
    ...overrides
  }) as unknown as LiveState;

const event = {
  match_id: "soccer:wc:eng-gha",
  context_status: "new",
  context_fingerprint: "ctx_eng_gha",
  context: {
    match: {
      match_id: "soccer:wc:eng-gha",
      match_name: "England vs Ghana",
      sport: "soccer",
      tournament_name: "FIFA World Cup",
      tournament_stage: "Group Stage",
      scheduled_start_time: "2026-06-23T20:00:00.000Z",
      venue: {
        stadium: "Gillette Stadium",
        city: "Boston",
        state: "Massachusetts",
        country: "United States"
      }
    },
    participants: [
      {
        participant_id: "eng",
        name: "England",
        short_name: "ENG",
        role: "home",
        ranking: "4",
        recent_form: ["W", "W", "D"]
      },
      {
        participant_id: "gha",
        name: "Ghana",
        short_name: "GHA",
        role: "away",
        ranking: "65",
        recent_form: ["W", "D", "L"]
      }
    ],
    pre_match_intelligence: {
      headline: "England vs Ghana",
      summary: "Group stage match.",
      expected_competitiveness: 75,
      key_matchup: "Midfield control"
    },
    context_version: 1,
    context_fingerprint: "ctx_eng_gha",
    context_generated_at: "2026-06-23T19:55:00.000Z"
  },
  live_state: buildLiveState({
    sources: [
      {
        title: "ESPN Match Center",
        url: "https://www.espn.com/soccer/match/_/gameId/demo",
        domain: "espn.com",
        provider: "Google Search"
      }
    ]
  }),
  freshness: {
    discovered_at: "2026-06-23T20:12:00.000Z",
    context_generated_at: "2026-06-23T19:55:00.000Z",
    state_generated_at: "2026-06-23T20:12:00.000Z",
    discovery_age_seconds: 5,
    context_age_seconds: 60,
    state_age_seconds: 3
  }
} as unknown as LiveEvent;

describe("LiveMatchTracker", () => {
  it("shows the merged list of unique sources across history and current state", () => {
    const history = [
      {
        capturedAt: "2026-06-23T20:08:00.000Z",
        liveState: buildLiveState({
          sources: [
            {
              title: "BBC Live",
              url: "https://www.bbc.com/sport/football/demo",
              domain: "bbc.com",
              provider: "Google Search"
            }
          ]
        })
      },
      {
        capturedAt: "2026-06-23T20:12:00.000Z",
        liveState: buildLiveState({
          sources: [
            {
              title: "ESPN Match Center",
              url: "https://www.espn.com/soccer/match/_/gameId/demo",
              domain: "espn.com",
              provider: "Google Search"
            }
          ]
        })
      }
    ];

    render(<LiveMatchTracker event={event} history={history} />);

    expect(
      screen.getByRole("link", { name: "BBC Live" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ESPN Match Center" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("ESPN Match Center")).toHaveLength(1);
  });
});
