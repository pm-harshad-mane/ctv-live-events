import {
  cleanup,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/App";

const originalFetch = global.fetch;

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as Response;

describe("App", () => {
  beforeEach(() => {
    window.location.hash = "";
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/config")) {
        return jsonResponse({
          data: {
            api_version: "v1",
            ai_service_available: true,
            discovery_refresh_after_seconds: 300,
            state_refresh_after_seconds: 60,
            max_live_events: 50,
            public_api_access: true,
            use_mock_data: true,
            active_model: "mock",
            available_models: [
              { id: "mock", label: "MockData" },
              { id: "openai", label: "ChatGPT 4.5 mini" },
              { id: "gemini", label: "Gemini 3" }
            ]
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/runtime/model")) {
        return jsonResponse({
          data: {
            api_version: "v1",
            ai_service_available: true,
            discovery_refresh_after_seconds: 300,
            state_refresh_after_seconds: 60,
            max_live_events: 50,
            public_api_access: true,
            use_mock_data: false,
            active_model: "openai",
            available_models: [
              { id: "mock", label: "MockData" },
              { id: "openai", label: "ChatGPT 4.5 mini" },
              { id: "gemini", label: "Gemini 3" }
            ]
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/events/live/discover")) {
        return jsonResponse({
          data: {
            request: {
              region: "north-america",
              sport: "all",
              include_context: true
            },
            meta: {
              count: 1,
              region: "north-america",
              sport: "all",
              state_refresh_after_seconds: 60,
              discovery_refresh_after_seconds: 300,
              ai_service_available: true
            },
            events: [
              {
                match_id: "basketball:nba:demo",
                context_status: "new",
                context_fingerprint: "ctx_demo",
                context: {
                  match: {
                    match_id: "basketball:nba:demo",
                    match_name: "Boston Celtics vs Golden State Warriors",
                    sport: "basketball",
                    tournament_name: "NBA",
                    tournament_stage: "Regular Season",
                    scheduled_start_time: "2026-06-16T19:00:00.000Z",
                    venue: {
                      stadium: "Chase Center",
                      city: "San Francisco",
                      state: "California",
                      country: "United States"
                    }
                  },
                  participants: [
                    {
                      participant_id: "bos",
                      name: "Boston Celtics",
                      short_name: "BOS",
                      role: "away",
                      ranking: "2",
                      recent_form: ["W", "W", "L"]
                    },
                    {
                      participant_id: "gsw",
                      name: "Golden State Warriors",
                      short_name: "GSW",
                      role: "home",
                      ranking: "5",
                      recent_form: ["W", "L", "W"]
                    }
                  ],
                  pre_match_intelligence: {
                    headline: "Demo headline",
                    summary: "Demo summary",
                    expected_competitiveness: 87,
                    key_matchup: "Demo matchup"
                  },
                  context_version: 1,
                  context_fingerprint: "ctx_demo",
                  context_generated_at: "2026-06-16T18:45:00.000Z"
                },
                live_state: {
                  match_id: "basketball:nba:demo",
                  match_status: "live",
                  period: {
                    code: "fourth_quarter",
                    display: "4th Quarter"
                  },
                  clock: {
                    display: "02:14",
                    elapsed_seconds: 100,
                    remaining_seconds: 134
                  },
                  score: {
                    participant_scores: [
                      {
                        participant_id: "bos",
                        display_score: "102",
                        numeric_score: 102
                      },
                      {
                        participant_id: "gsw",
                        display_score: "100",
                        numeric_score: 100
                      }
                    ],
                    display: "102-100",
                    score_differential: 2
                  },
                  sport_specific: {
                    quarter: 4
                  },
                  current_possession_or_control: {
                    participant_id: "bos",
                    description: "Boston has the ball in the front court."
                  },
                  active_players: [
                    {
                      player_id: "bos-lead-guard",
                      player_name: "Boston Lead Guard",
                      participant_id: "bos",
                      role: "Primary ball handler",
                      status: "On court",
                      impact_summary: "Running the offense late.",
                      key_metrics: [
                        { label: "Points", value: "26" },
                        { label: "Assists", value: "8" }
                      ]
                    },
                    {
                      player_id: "gsw-wing-scorer",
                      player_name: "Golden State Wing Scorer",
                      participant_id: "gsw",
                      role: "Primary scorer",
                      status: "On court",
                      impact_summary: "Keeping the margin tight.",
                      key_metrics: [
                        { label: "Points", value: "24" },
                        { label: "3PT", value: "4" }
                      ]
                    }
                  ],
                  what_is_happening: {
                    headline: "Demo headline",
                    summary: "Demo state summary",
                    situation_code: "close_finish",
                    key_entity_ids: ["bos", "gsw"]
                  },
                  last_major_event: {
                    event_id: "evt_1",
                    event_type: "score",
                    participant_id: "bos",
                    player_id: "bos-1",
                    description: "Demo event",
                    match_time: "02:14",
                    event_importance: 90
                  },
                  recent_events: [],
                  special_state: {
                    is_timeout: false,
                    is_under_review: false,
                    is_injury_delay: false,
                    is_weather_delay: false,
                    is_overtime_or_tiebreak: false
                  },
                  excitement: {
                    aggregate_score: 94,
                    level: "high",
                    current_excitement: 94,
                    recent_excitement: 92,
                    expected_remaining_excitement: 95,
                    reason_codes: ["close_score", "late_match"]
                  },
                  criticality: {
                    score: 91,
                    level: "high",
                    reason_codes: ["late_match", "close_score"]
                  },
                  competitive_balance: {
                    score: 92,
                    level: "very_close"
                  },
                  momentum: {
                    leading_participant_id: "bos",
                    score: 78,
                    direction: "increasing",
                    summary: "Demo momentum",
                    reason_codes: ["recent_scoring_run"]
                  },
                  live_predictions: {
                    win_probabilities: [
                      {
                        participant_id: "bos",
                        probability: 0.56
                      },
                      {
                        participant_id: "gsw",
                        probability: 0.44
                      }
                    ],
                    win_probability_changes: [
                      {
                        participant_id: "bos",
                        last_interval: 0.05
                      },
                      {
                        participant_id: "gsw",
                        last_interval: -0.05
                      }
                    ],
                    comeback_probability: 0.44,
                    upset_probability: 0.31,
                    draw_probability: 0.01,
                    overtime_or_tiebreak_probability: 0.08,
                    likely_next_major_event: "score",
                    expected_remaining_duration_minutes: 2,
                    prediction_confidence: 0.82
                  },
                  summary: {
                    headline: "Demo summary",
                    short_byte: "Boston 102, Golden State 100.",
                    key_points: ["The score is tight"]
                  },
                  freshness: {
                    generated_at: "2026-06-16T20:04:05.000Z",
                    source_observation_time: null,
                    age_seconds: 0
                  },
                  verification: {
                    status: "verified",
                    confidence: 0.82,
                    warnings: []
                  }
                },
                freshness: {
                  context_generated_at: "2026-06-16T18:45:00.000Z",
                  state_generated_at: "2026-06-16T20:04:05.000Z",
                  context_age_seconds: 100,
                  state_age_seconds: 0
                }
              }
            ]
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/events/live/state")) {
        return jsonResponse({
          data: {
            meta: {
              count: 1,
              region: "north-america",
              sport: "all",
              state_refresh_after_seconds: 60,
              discovery_refresh_after_seconds: 300,
              ai_service_available: true
            },
            states: [],
            failed_matches: []
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/events/live/basketball%3Anba%3Ademo/context")) {
        return jsonResponse({
          data: {
            match_id: "basketball:nba:demo",
            context: {
              match: {
                match_id: "basketball:nba:demo",
                match_name: "Boston Celtics vs Golden State Warriors",
                sport: "basketball",
                tournament_name: "NBA",
                tournament_stage: "Regular Season",
                scheduled_start_time: "2026-06-16T19:00:00.000Z",
                venue: {
                  stadium: "Chase Center",
                  city: "San Francisco",
                  state: "California",
                  country: "United States"
                }
              },
              participants: [
                {
                  participant_id: "bos",
                  name: "Boston Celtics",
                  short_name: "BOS",
                  role: "away",
                  ranking: "2",
                  recent_form: ["W", "W", "L"]
                },
                {
                  participant_id: "gsw",
                  name: "Golden State Warriors",
                  short_name: "GSW",
                  role: "home",
                  ranking: "5",
                  recent_form: ["W", "L", "W"]
                }
              ],
              pre_match_intelligence: {
                headline: "Detail headline",
                summary: "Detail summary",
                expected_competitiveness: 87,
                key_matchup: "Detail endpoint matchup"
              },
              context_version: 1,
              context_fingerprint: "ctx_demo",
              context_generated_at: "2026-06-16T18:45:00.000Z"
            },
            freshness: {
              context_generated_at: "2026-06-16T18:45:00.000Z"
            }
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/events/live/basketball%3Anba%3Ademo/state")) {
        return jsonResponse({
          data: {
            match_id: "basketball:nba:demo",
            live_state: {
              match_id: "basketball:nba:demo",
              match_status: "live",
              period: {
                code: "fourth_quarter",
                display: "4th Quarter"
              },
              clock: {
                display: "01:48",
                elapsed_seconds: 100,
                remaining_seconds: 108
              },
              score: {
                participant_scores: [
                  {
                    participant_id: "bos",
                    display_score: "104",
                    numeric_score: 104
                  },
                  {
                    participant_id: "gsw",
                    display_score: "103",
                    numeric_score: 103
                  }
                ],
                display: "104-103",
                score_differential: 1
              },
              sport_specific: {
                quarter: 4
              },
              current_possession_or_control: {
                participant_id: "bos",
                description: "Boston is working a late possession."
              },
              active_players: [
                {
                  player_id: "bos-lead-guard",
                  player_name: "Boston Lead Guard",
                  participant_id: "bos",
                  role: "Primary ball handler",
                  status: "On court",
                  impact_summary: "Running the offense late.",
                  key_metrics: [
                    { label: "Points", value: "29" },
                    { label: "Assists", value: "9" }
                  ]
                },
                {
                  player_id: "gsw-wing-scorer",
                  player_name: "Golden State Wing Scorer",
                  participant_id: "gsw",
                  role: "Primary scorer",
                  status: "On court",
                  impact_summary: "Attacking the switch coverage.",
                  key_metrics: [
                    { label: "Points", value: "27" },
                    { label: "3PT", value: "5" }
                  ]
                }
              ],
              what_is_happening: {
                headline: "Detail endpoint headline",
                summary: "Detail endpoint state summary",
                situation_code: "close_finish",
                key_entity_ids: ["bos", "gsw"]
              },
              last_major_event: {
                event_id: "evt_2",
                event_type: "score",
                participant_id: "bos",
                player_id: "bos-7",
                description: "Detail endpoint last event",
                match_time: "01:48",
                event_importance: 92
              },
              recent_events: [],
              special_state: {
                is_timeout: false,
                is_under_review: false,
                is_injury_delay: false,
                is_weather_delay: false,
                is_overtime_or_tiebreak: false
              },
              excitement: {
                aggregate_score: 96,
                level: "high",
                current_excitement: 96,
                recent_excitement: 94,
                expected_remaining_excitement: 97,
                reason_codes: ["close_score", "late_match"]
              },
              criticality: {
                score: 93,
                level: "high",
                reason_codes: ["late_match", "one_possession_game"]
              },
              competitive_balance: {
                score: 95,
                level: "very_close"
              },
              momentum: {
                leading_participant_id: "bos",
                score: 80,
                direction: "increasing",
                summary: "Detail endpoint momentum",
                reason_codes: ["recent_scoring_run"]
              },
              live_predictions: {
                win_probabilities: [
                  {
                    participant_id: "bos",
                    probability: 0.58
                  },
                  {
                    participant_id: "gsw",
                    probability: 0.42
                  }
                ],
                win_probability_changes: [
                  {
                    participant_id: "bos",
                    last_interval: 0.06
                  },
                  {
                    participant_id: "gsw",
                    last_interval: -0.06
                  }
                ],
                comeback_probability: 0.42,
                upset_probability: 0.29,
                draw_probability: 0.01,
                overtime_or_tiebreak_probability: 0.11,
                likely_next_major_event: "score",
                expected_remaining_duration_minutes: 2,
                prediction_confidence: 0.85
              },
              summary: {
                headline: "Detail endpoint summary headline",
                short_byte: "Boston 104, Golden State 103.",
                key_points: ["Detail endpoint key point"]
              },
              freshness: {
                generated_at: "2026-06-16T20:05:05.000Z",
                source_observation_time: null,
                age_seconds: 0
              },
              verification: {
                status: "verified",
                confidence: 0.85,
                warnings: []
              }
            },
            freshness: {
              state_generated_at: "2026-06-16T20:05:05.000Z"
            }
          },
          warnings: []
        });
      }

      if (url.includes("/api/v1/events/upcoming?")) {
        return jsonResponse({
          data: {
            meta: {
              count: 1,
              region: "north-america",
              sport: "all",
              days: 7,
              ai_service_available: true
            },
            events: [
              {
                match_id: "basketball:nba:upcoming-demo",
                context: {
                  match: {
                    match_id: "basketball:nba:upcoming-demo",
                    match_name: "New York Knicks vs Milwaukee Bucks",
                    sport: "basketball",
                    tournament_name: "NBA",
                    tournament_stage: "Regular Season",
                    scheduled_start_time: "2026-06-18T23:30:00.000Z",
                    venue: {
                      stadium: "Madison Square Garden",
                      city: "New York",
                      state: "New York",
                      country: "United States"
                    }
                  },
                  participants: [
                    {
                      participant_id: "nyk",
                      name: "New York Knicks",
                      short_name: "NYK",
                      role: "home",
                      ranking: "3",
                      recent_form: ["W", "W", "L"]
                    },
                    {
                      participant_id: "mil",
                      name: "Milwaukee Bucks",
                      short_name: "MIL",
                      role: "away",
                      ranking: "4",
                      recent_form: ["W", "L", "W"]
                    }
                  ],
                  pre_match_intelligence: {
                    headline: "Upcoming demo headline",
                    summary: "Upcoming demo summary",
                    expected_competitiveness: 84,
                    key_matchup: "Upcoming demo matchup"
                  },
                  context_version: 1,
                  context_fingerprint: "ctx_upcoming_demo",
                  context_generated_at: "2026-06-16T18:45:00.000Z"
                },
                upcoming_intelligence: {
                  headline: "A likely playoff-preview level contest",
                  summary:
                    "This game projects as one of the stronger upcoming matchups.",
                  projected_competitiveness: 84,
                  watch_reasons: [
                    "Both teams are in strong recent form",
                    "The matchup has seeding implications"
                  ],
                  win_probabilities: [
                    {
                      participant_id: "nyk",
                      probability: 0.52
                    },
                    {
                      participant_id: "mil",
                      probability: 0.48
                    }
                  ]
                },
                freshness: {
                  generated_at: "2026-06-16T20:04:05.000Z",
                  age_seconds: 0
                }
              }
            ]
          },
          warnings: []
        });
      }

      if (
        url.endsWith("/api/v1/events/upcoming/basketball%3Anba%3Aupcoming-demo")
      ) {
        return jsonResponse({
          data: {
            event: {
              match_id: "basketball:nba:upcoming-demo",
              context: {
                match: {
                  match_id: "basketball:nba:upcoming-demo",
                  match_name: "New York Knicks vs Milwaukee Bucks",
                  sport: "basketball",
                  tournament_name: "NBA",
                  tournament_stage: "Regular Season",
                  scheduled_start_time: "2026-06-18T23:30:00.000Z",
                  venue: {
                    stadium: "Madison Square Garden",
                    city: "New York",
                    state: "New York",
                    country: "United States"
                  }
                },
                participants: [
                  {
                    participant_id: "nyk",
                    name: "New York Knicks",
                    short_name: "NYK",
                    role: "home",
                    ranking: "3",
                    recent_form: ["W", "W", "L"]
                  },
                  {
                    participant_id: "mil",
                    name: "Milwaukee Bucks",
                    short_name: "MIL",
                    role: "away",
                    ranking: "4",
                    recent_form: ["W", "L", "W"]
                  }
                ],
                pre_match_intelligence: {
                  headline: "Upcoming detail headline",
                  summary: "Upcoming detail summary",
                  expected_competitiveness: 84,
                  key_matchup: "Upcoming detail matchup"
                },
                context_version: 1,
                context_fingerprint: "ctx_upcoming_demo",
                context_generated_at: "2026-06-16T18:45:00.000Z"
              },
              upcoming_intelligence: {
                headline: "Upcoming detail endpoint headline",
                summary: "Upcoming detail endpoint summary",
                projected_competitiveness: 84,
                watch_reasons: [
                  "Upcoming detail reason one",
                  "Upcoming detail reason two"
                ],
                win_probabilities: [
                  {
                    participant_id: "nyk",
                    probability: 0.52
                  },
                  {
                    participant_id: "mil",
                    probability: 0.48
                  }
                ]
              },
              freshness: {
                generated_at: "2026-06-16T20:04:05.000Z",
                age_seconds: 0
              }
            }
          },
          warnings: []
        });
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it("shows loading states before initial data resolves", () => {
    render(<App />);

    expect(screen.getByText("Loading live soccer...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live" })).toBeInTheDocument();
    expect(
      screen.queryByText("Loading upcoming soccer...", { exact: false })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No live soccer matches are available right now/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Next state refresh in/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Searching for newly started matches every/i)
    ).not.toBeInTheDocument();
  });

  it("renders live event cards after bootstrap", async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Boston Celtics vs Golden State Warriors"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("56%")).toBeInTheDocument();
    expect(screen.getByText("44%")).toBeInTheDocument();
    expect(screen.getByText("Criticality")).toBeInTheDocument();
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(
      screen.getByText("Time left: 2m 14s", { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Location: Chase Center, San Francisco, California, United States",
        { exact: false }
      )
    ).toBeInTheDocument();
  });

  it("switches to the upcoming page from the nav", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Upcoming" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Upcoming matches." })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", {
        name: "New York Knicks vs Milwaukee Bucks"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("52%")).toBeInTheDocument();
    expect(screen.getByText("48%")).toBeInTheDocument();
    expect(screen.getByText("Competitiveness")).toBeInTheDocument();
  });

  it("shows manual refresh actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Refresh live state" })
      ).toBeVisible();
    });

    await user.click(
      screen.getByRole("button", { name: "Find new live matches" })
    );
    expect(
      screen.getByText(/Searching for newly started matches every/i)
    ).toBeInTheDocument();
  });

  it("keeps the stronger live score when a generic zeroed refresh regresses it", async () => {
    const user = userEvent.setup();
    const baseFetch = global.fetch;

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/events/live/state")) {
        return jsonResponse({
          data: {
            meta: {
              count: 1,
              region: "north-america",
              sport: "all",
              state_refresh_after_seconds: 60,
              discovery_refresh_after_seconds: 300,
              ai_service_available: true
            },
            states: [
              {
                match_id: "basketball:nba:demo",
                match_status: "live",
                period: {
                  code: "fourth_quarter",
                  display: "4th Quarter"
                },
                clock: {
                  display: "01:48",
                  elapsed_seconds: 126,
                  remaining_seconds: 108
                },
                score: {
                  participant_scores: [
                    {
                      participant_id: "bos",
                      display_score: "0",
                      numeric_score: 0
                    },
                    {
                      participant_id: "gsw",
                      display_score: "0",
                      numeric_score: 0
                    }
                  ],
                  display: "0-0",
                  score_differential: 0
                },
                sport_specific: {
                  quarter: 4
                },
                current_possession_or_control: {
                  participant_id: "bos",
                  description: "Boston has the ball in the front court."
                },
                active_players: [],
                what_is_happening: {
                  headline: "Match in progress",
                  summary: "Generic live fallback",
                  situation_code: "active_play",
                  key_entity_ids: ["bos", "gsw"]
                },
                last_major_event: {
                  event_id: "evt_fallback",
                  event_type: "status",
                  participant_id: "bos",
                  player_id: null,
                  description: "Generic fallback event",
                  match_time: "01:48",
                  event_importance: 10
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
                  aggregate_score: 50,
                  level: "medium",
                  current_excitement: 50,
                  recent_excitement: 50,
                  expected_remaining_excitement: 50,
                  reason_codes: []
                },
                criticality: {
                  score: 50,
                  level: "medium",
                  reason_codes: []
                },
                competitive_balance: {
                  score: 50,
                  level: "even"
                },
                watchability: {
                  current_score: 50,
                  tension_score: 50,
                  scoring_imminence_score: 50,
                  swing_potential_score: 50,
                  state_clarity_score: 50,
                  evidence_strength_score: 50
                },
                cross_phase_scores: {
                  stakes_score: 50,
                  star_power_score: 50,
                  upset_potential_score: 50,
                  narrative_strength_score: 50
                },
                momentum: {
                  leading_participant_id: "bos",
                  score: 50,
                  direction: "flat",
                  summary: "Generic fallback momentum",
                  reason_codes: []
                },
                live_predictions: {
                  win_probabilities: [
                    {
                      participant_id: "bos",
                      probability: 0.5
                    },
                    {
                      participant_id: "gsw",
                      probability: 0.5
                    }
                  ],
                  win_probability_changes: [
                    {
                      participant_id: "bos",
                      last_interval: 0
                    },
                    {
                      participant_id: "gsw",
                      last_interval: 0
                    }
                  ],
                  comeback_probability: 0.5,
                  upset_probability: 0.5,
                  draw_probability: 0,
                  overtime_or_tiebreak_probability: 0.1,
                  likely_next_major_event: "score",
                  expected_remaining_duration_minutes: 2,
                  prediction_confidence: 1
                },
                summary: {
                  headline: "Match in progress",
                  short_byte: "Match in progress",
                  key_points: []
                },
                freshness: {
                  generated_at: "2026-06-16T20:06:05.000Z",
                  source_observation_time: null,
                  age_seconds: 0
                },
                verification: {
                  status: "verified",
                  confidence: 1,
                  warnings: []
                }
              }
            ],
            failed_matches: []
          },
          warnings: []
        });
      }

      return baseFetch(input, init);
    }) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Boston Celtics vs Golden State Warriors"
        })
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Refresh live state" })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/events/live/state"),
        expect.anything()
      );
    });

    expect(screen.getByText("102-100")).toBeInTheDocument();
  });

  it("refetches upcoming events when the day window changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Upcoming" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("7 days")).toBeVisible();
    });

    await user.selectOptions(screen.getByDisplayValue("7 days"), "14");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/events/upcoming?region=north-america&sport=soccer&days=14"
        ),
        expect.anything()
      );
    });
  });

  it("sends the selected region when filters change", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("North America")).toBeVisible();
    });

    await user.selectOptions(
      screen.getByDisplayValue("North America"),
      "europe"
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/events/upcoming?region=europe&sport=soccer&days=7"
        ),
        expect.anything()
      );
    });
  });

  it("shows all enabled sports while keeping soccer selected by default", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Soccer")).toBeVisible();
    });

    const sportSelect = screen.getByDisplayValue("Soccer");
    const optionLabels = within(sportSelect)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(optionLabels).toEqual([
      "All",
      "American Football",
      "Baseball",
      "Basketball",
      "Cricket",
      "Hockey",
      "MMA",
      "Soccer",
      "Tennis"
    ]);
  });

  it("shows the enabled data sources and lets the user switch models", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Boston Celtics vs Golden State Warriors"
        })
      ).toBeInTheDocument();
    });

    const sourceSelect = await screen.findByDisplayValue("MockData");
    const optionLabels = within(sourceSelect)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(optionLabels).toEqual(["MockData", "ChatGPT 4.5 mini", "Gemini 3"]);

    await user.selectOptions(sourceSelect, "openai");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/runtime/model",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ model: "openai" })
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load live matches" })
      ).toBeInTheDocument();
    });
  });

  it("waits for an explicit click before fetching in non-mock mode", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/config")) {
        return jsonResponse({
          data: {
            api_version: "v1",
            ai_service_available: true,
            discovery_refresh_after_seconds: 300,
            state_refresh_after_seconds: 60,
            max_live_events: 50,
            public_api_access: true,
            use_mock_data: false,
            active_model: "openai",
            available_models: [
              { id: "mock", label: "MockData" },
              { id: "openai", label: "ChatGPT 4.5 mini" },
              { id: "gemini", label: "Gemini 3" }
            ]
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/runtime/model")) {
        return jsonResponse({
          data: {
            api_version: "v1",
            ai_service_available: true,
            discovery_refresh_after_seconds: 300,
            state_refresh_after_seconds: 60,
            max_live_events: 50,
            public_api_access: true,
            use_mock_data: false,
            active_model: "openai",
            available_models: [
              { id: "mock", label: "MockData" },
              { id: "openai", label: "ChatGPT 4.5 mini" },
              { id: "gemini", label: "Gemini 3" }
            ]
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/events/live/discover")) {
        return jsonResponse({
          data: {
            request: {
              region: "north-america",
              sport: "soccer",
              include_context: true
            },
            meta: {
              count: 0,
              region: "north-america",
              sport: "soccer",
              state_refresh_after_seconds: 60,
              discovery_refresh_after_seconds: 300,
              ai_service_available: true
            },
            events: []
          },
          warnings: []
        });
      }

      if (url.includes("/api/v1/events/upcoming?")) {
        return jsonResponse({
          data: {
            meta: {
              count: 0,
              region: "north-america",
              sport: "soccer",
              days: 7,
              ai_service_available: true
            },
            events: []
          },
          warnings: []
        });
      }

      return jsonResponse({});
    }) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText("Choose filters and click Load live matches.")
      ).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/events/live/discover"),
      expect.anything()
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/events/upcoming?"),
      expect.anything()
    );

    await user.click(screen.getByRole("button", { name: "Load live matches" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/events/live/discover"),
        expect.anything()
      );
    });

    await user.click(screen.getByRole("link", { name: "Upcoming" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Upcoming matches." })
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: "Load upcoming matches" })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/events/upcoming?"),
        expect.anything()
      );
    });
  });

  it("uses prefetched live data for match details without another request", async () => {
    const user = userEvent.setup();
    render(<App />);

    const liveHeading = await screen.findByRole("heading", {
      name: "Currently live matches."
    });
    const liveSection = liveHeading.closest("section");

    expect(liveSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(liveSection as HTMLElement).getByRole("heading", {
          name: "Boston Celtics vs Golden State Warriors"
        })
      ).toBeInTheDocument();
    });

    await user.click(
      within(liveSection as HTMLElement).getByRole("button", {
        name: "More Details"
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Demo summary")).toBeInTheDocument();
    });

    const detailDialog = screen.getByRole("dialog");

    expect(
      within(detailDialog).getByText(
        /Chase Center, San Francisco, California, United States/
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText(/Time left: 2m 1[34]s/)
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Demo state summary")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText(/Boston Lead Guard/)
    ).toBeInTheDocument();
    expect(within(detailDialog).getByText(/Points 26/)).toBeInTheDocument();
    expect(
      within(detailDialog).getByLabelText(
        /Comeback probability\. The chance that the currently trailing side still manages to win\./
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Boston Celtics: 56%")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Boston Celtics: +5 pts")
    ).toBeInTheDocument();
    expect(within(detailDialog).getByText("evt_1")).toBeInTheDocument();
    expect(within(detailDialog).getByText("Quarter")).toBeInTheDocument();
    expect(within(detailDialog).getByText("4")).toBeInTheDocument();
    expect(
      within(detailDialog).getByLabelText(
        /Status\. The current lifecycle state of the match/
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).queryByText(/"quarter": 4/)
    ).not.toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/events/live/basketball%3Anba%3Ademo/context"
      ),
      expect.anything()
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/events/live/basketball%3Anba%3Ademo/state"
      ),
      expect.anything()
    );
  });

  it("uses prefetched upcoming data for match details without another request", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Upcoming" }));

    const upcomingHeading = await screen.findByRole("heading", {
      name: "Upcoming matches."
    });
    const upcomingSection = upcomingHeading.closest("section");

    expect(upcomingSection).not.toBeNull();

    const upcomingCard = within(upcomingSection as HTMLElement)
      .getByRole("heading", { name: "New York Knicks vs Milwaukee Bucks" })
      .closest("article");

    expect(upcomingCard).not.toBeNull();

    await user.click(
      within(upcomingCard as HTMLElement).getByRole("button", {
        name: "More Details"
      })
    );

    const detailDialog = screen.getByRole("dialog");

    expect(
      within(detailDialog).getByText("A likely playoff-preview level contest")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByLabelText(
        /Projected competitiveness\. A pre-match score estimating how close and compelling this matchup is expected to be\./
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByLabelText(
        /Win probabilities\. The pre-match chances for each side to win based on the current upcoming-match outlook\./
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("New York Knicks: 52%")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Milwaukee Bucks: 48%")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Upcoming demo summary")
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/events/upcoming/basketball%3Anba%3Aupcoming-demo"
      ),
      expect.anything()
    );
  });

  it("shows yet-to-start status and time left for matches scheduled later today", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const sameDayFutureStart = new Date(now.getTime() + 60 * 60 * 1000);

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/config")) {
        return jsonResponse({
          data: {
            api_version: "v1",
            ai_service_available: true,
            discovery_refresh_after_seconds: 300,
            state_refresh_after_seconds: 60,
            max_live_events: 50,
            public_api_access: true,
            use_mock_data: true,
            active_model: "mock",
            available_models: [{ id: "mock", label: "MockData" }]
          },
          warnings: []
        });
      }

      if (url.endsWith("/api/v1/events/live/discover")) {
        return jsonResponse({
          data: {
            request: {
              region: "north-america",
              sport: "soccer",
              include_context: true
            },
            meta: {
              count: 0,
              region: "north-america",
              sport: "soccer",
              state_refresh_after_seconds: 60,
              discovery_refresh_after_seconds: 300,
              ai_service_available: true
            },
            events: []
          },
          warnings: []
        });
      }

      if (url.includes("/api/v1/events/upcoming?")) {
        return jsonResponse({
          data: {
            meta: {
              count: 1,
              region: "north-america",
              sport: "soccer",
              days: 7,
              ai_service_available: true
            },
            events: [
              {
                match_id: "soccer:friendly:today-demo",
                context: {
                  match: {
                    match_id: "soccer:friendly:today-demo",
                    match_name: "LAFC vs Seattle Sounders",
                    sport: "soccer",
                    tournament_name: "MLS",
                    tournament_stage: "Regular Season",
                    scheduled_start_time: sameDayFutureStart.toISOString(),
                    venue: {
                      stadium: "BMO Stadium",
                      city: "Los Angeles",
                      state: "California",
                      country: "United States"
                    }
                  },
                  participants: [
                    {
                      participant_id: "lafc",
                      name: "LAFC",
                      short_name: "LAFC",
                      role: "home",
                      ranking: "1",
                      recent_form: ["W", "W", "D"]
                    },
                    {
                      participant_id: "sea",
                      name: "Seattle Sounders",
                      short_name: "SEA",
                      role: "away",
                      ranking: "4",
                      recent_form: ["W", "L", "W"]
                    }
                  ],
                  pre_match_intelligence: {
                    headline: "Same-day rivalry match",
                    summary: "This match is scheduled later today.",
                    expected_competitiveness: 82,
                    key_matchup: "Transition speed against possession control"
                  },
                  context_version: 1,
                  context_fingerprint: "ctx_today_demo",
                  context_generated_at: "2026-06-16T17:30:00.000Z"
                },
                upcoming_intelligence: {
                  headline: "Later today in Los Angeles",
                  summary: "A same-day start should be called out clearly.",
                  projected_competitiveness: 82,
                  watch_reasons: ["High-table meeting"],
                  win_probabilities: [
                    { participant_id: "lafc", probability: 0.55 },
                    { participant_id: "sea", probability: 0.45 }
                  ]
                },
                freshness: {
                  generated_at: now.toISOString(),
                  age_seconds: 0
                }
              }
            ]
          },
          warnings: []
        });
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<App />);
    await user.click(screen.getByRole("link", { name: "Upcoming" }));

    const upcomingCard = await screen.findByRole("heading", {
      name: "LAFC vs Seattle Sounders"
    });
    const article = upcomingCard.closest("article");

    expect(article).not.toBeNull();
    expect(
      within(article as HTMLElement).getByText(/\d{1,2}\/\d{1,2}\/\d{4},/)
    ).toBeInTheDocument();
    expect(
      within(article as HTMLElement).getByText("Time left")
    ).toBeInTheDocument();
  });
});
