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
            public_api_access: true
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
    expect(screen.getByRole("button", { name: "Live" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Upcoming" }));

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

  it("refetches upcoming events when the day window changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Upcoming" }));

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

  it("loads dedicated live detail endpoints for the selected live match", async () => {
    const user = userEvent.setup();
    render(<App />);

    const liveHeading = await screen.findByRole("heading", {
      name: "Currently live matches."
    });
    const liveSection = liveHeading.closest("section");

    expect(liveSection).not.toBeNull();

    await user.click(
      within(liveSection as HTMLElement).getByRole("button", {
        name: "Details"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Detail endpoint summary headline")
      ).toBeInTheDocument();
    });

    const detailDialog = screen.getByRole("dialog");

    expect(
      within(detailDialog).getByText(
        /Chase Center, San Francisco, California, United States/
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Time left: 1m 48s")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Boston is working a late possession.")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByLabelText(
        /Comeback probability\. The chance that the currently trailing side still manages to win\./
      )
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Boston Celtics: 58%")
    ).toBeInTheDocument();
    expect(
      within(detailDialog).getByText("Boston Celtics: +6 pts")
    ).toBeInTheDocument();
    expect(within(detailDialog).getByText("evt_2")).toBeInTheDocument();
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

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/events/live/basketball%3Anba%3Ademo/context"
      ),
      expect.anything()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/events/live/basketball%3Anba%3Ademo/state"
      ),
      expect.anything()
    );
  });

  it("uses prefetched upcoming data for match details without another request", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Upcoming" }));

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
        name: "Details"
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
      expect.stringContaining("/api/v1/events/upcoming/basketball%3Anba%3Aupcoming-demo"),
      expect.anything()
    );
  });
});
