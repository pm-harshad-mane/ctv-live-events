import { describe, expect, it, vi } from "vitest";
import {
  OpenAiLiveEventDiscoveryProvider,
  OpenAiLiveEventStateProvider,
  OpenAiUpcomingEventProvider
} from "../../src/server/providers/openai/openAiProviders";
import type { StructuredResponseTransport } from "../../src/server/openai/transport";

const withWebSearchMetadata = <T extends object>(
  payload: T,
  overrides?: Partial<{
    tool_invoked: boolean;
    call_count: number;
    source_count: number;
    sources: string[];
  }>
) => ({
  ...payload,
  _openai_metadata: {
    web_search: {
      tool_invoked: overrides?.tool_invoked ?? true,
      call_count: overrides?.call_count ?? 1,
      source_count: overrides?.source_count ?? 2,
      sources: overrides?.sources ?? ["oai-sports", "cbssports.com"]
    }
  }
});

const createTransport = (
  responseFactory: (request: {
    instructions: string;
    input: string;
    schema: { name: string; schema: Record<string, unknown> };
    maxOutputTokens?: number;
    tools?: Array<Record<string, unknown>>;
    toolChoice?: "auto" | "none";
    include?: string[];
  }) => unknown
): StructuredResponseTransport & {
  createStructuredResponse: ReturnType<typeof vi.fn>;
} => ({
  createStructuredResponse: vi.fn(async (request) => responseFactory(request))
});

describe("OpenAI providers", () => {
  it("uses a distinct discovery schema and prompt", async () => {
    const transport = createTransport(() =>
      withWebSearchMetadata({
        events: [],
        warnings: []
      })
    );
    const provider = new OpenAiLiveEventDiscoveryProvider(transport);

    await provider.discover({
      region: "north-america",
      sport: "all",
      include_context: true,
      known_matches: []
    });

    expect(transport.createStructuredResponse).toHaveBeenCalledTimes(1);
    const request = transport.createStructuredResponse.mock.calls[0][0];
    expect(request.schema.name).toBe("live_discovery_response");
    expect(request.instructions).toContain(
      "discovering currently live sports matches"
    );
    expect(request.instructions).toContain("Use web search");
    expect(request.toolChoice).toBe("auto");
    expect(request.tools?.[0]?.type).toBe("web_search");
    expect(request.tools?.[0]?.external_web_access).toBe(true);
  });

  it("uses a state-refresh prompt that forbids static context fields", async () => {
    const transport = createTransport(() =>
      withWebSearchMetadata({
        states: [],
        failed_matches: [],
        warnings: []
      })
    );
    const provider = new OpenAiLiveEventStateProvider(transport);

    await provider.refreshStates({
      region: "north-america",
      sport: "basketball",
      matches: [
        {
          match_id: "basketball:nba:demo",
          sport: "basketball",
          tournament_name: "NBA",
          scheduled_start_time: "2026-06-16T19:00:00.000Z",
          participants: [
            {
              participant_id: "bos",
              name: "Boston Celtics",
              short_name: "BOS"
            },
            {
              participant_id: "gsw",
              name: "Golden State Warriors",
              short_name: "GSW"
            }
          ]
        }
      ]
    });

    const request = transport.createStructuredResponse.mock.calls[0][0];
    expect(request.schema.name).toBe("live_state_refresh_response");
    expect(request.instructions).toContain("refreshing only the dynamic state");
    expect(request.instructions).toContain("Use web search");
    expect(request.instructions).toContain(
      "Do not return static match context"
    );
    expect(request.toolChoice).toBe("auto");
    expect(request.tools?.[0]?.type).toBe("web_search");
    expect(request.tools?.[0]?.external_web_access).toBe(true);
    expect(request.input).not.toContain("venue");
    expect(request.input).not.toContain("recent_form");
  });

  it("uses a distinct upcoming prompt and schema", async () => {
    const transport = createTransport(() =>
      withWebSearchMetadata({
        events: [],
        warnings: []
      })
    );
    const provider = new OpenAiUpcomingEventProvider(transport);

    await provider.getUpcoming({
      region: "europe",
      sport: "soccer",
      days: 7
    });

    const request = transport.createStructuredResponse.mock.calls[0][0];
    expect(request.schema.name).toBe("upcoming_events_response");
    expect(request.instructions).toContain(
      "generating upcoming sports intelligence"
    );
    expect(request.instructions).toContain("Use web search");
    expect(request.toolChoice).toBe("auto");
    expect(request.tools?.[0]?.type).toBe("web_search");
    expect(request.tools?.[0]?.external_web_access).toBe(true);
  });

  it("filters low-confidence schedule-only live events from discovery", async () => {
    const transport = createTransport(() =>
      withWebSearchMetadata({
        events: [
          {
            match_id: "soccer:test:demo",
            context_status: "new",
            context_fingerprint: "ctx_demo",
            context: {
              match: {
                match_id: "soccer:test:demo",
                match_name: "France vs Senegal",
                sport: "soccer",
                tournament_name: "World Cup",
                tournament_stage: "Group Stage",
                scheduled_start_time: "2026-06-17T20:00:00Z",
                venue: {
                  stadium: "MetLife Stadium",
                  city: "East Rutherford",
                  state: "New Jersey",
                  country: "United States"
                }
              },
              participants: [
                {
                  participant_id: "fra",
                  name: "France",
                  short_name: "FRA",
                  role: "home",
                  ranking: null,
                  recent_form: []
                },
                {
                  participant_id: "sen",
                  name: "Senegal",
                  short_name: "SEN",
                  role: "away",
                  ranking: null,
                  recent_form: []
                }
              ],
              pre_match_intelligence: {
                headline: "Scheduled for today",
                summary: "No verified live action yet.",
                expected_competitiveness: 72,
                key_matchup: "France attack vs Senegal press"
              },
              context_version: 1,
              context_fingerprint: "ctx_demo",
              context_generated_at: "2026-06-17T01:00:00Z"
            },
            live_state: {
              match_id: "soccer:test:demo",
              match_status: "live",
              period: {
                code: "in_progress",
                display: "In Progress"
              },
              clock: {
                display: "0:00",
                elapsed_seconds: 0,
                remaining_seconds: 0
              },
              score: {
                participant_scores: [
                  {
                    participant_id: "fra",
                    display_score: "0",
                    numeric_score: 0
                  },
                  {
                    participant_id: "sen",
                    display_score: "0",
                    numeric_score: 0
                  }
                ],
                display: "0-0",
                score_differential: 0
              },
              sport_specific: {
                phase: "pre_live_monitoring"
              },
              current_possession_or_control: {
                participant_id: null,
                description:
                  "No verified possession or territorial control yet."
              },
              what_is_happening: {
                headline: "Scheduled for today",
                summary: "No verified live action yet.",
                situation_code: "scheduled",
                key_entity_ids: ["fra", "sen"]
              },
              last_major_event: {
                event_id: "evt_1",
                event_type: "status",
                participant_id: "fra",
                player_id: null,
                description: "Awaiting feed",
                match_time: "2026-06-17T01:00:00Z",
                event_importance: 10
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
                aggregate_score: 18,
                level: "low",
                current_excitement: 18,
                recent_excitement: 16,
                expected_remaining_excitement: 10,
                reason_codes: ["not_verified_live"]
              },
              criticality: {
                score: 15,
                level: "low",
                reason_codes: ["insufficient_live_evidence"]
              },
              competitive_balance: {
                score: 50,
                level: "even"
              },
              momentum: {
                leading_participant_id: "fra",
                score: 0,
                direction: "flat",
                summary: "No live momentum yet.",
                reason_codes: ["no_verified_sequence"]
              },
              live_predictions: {
                win_probabilities: [
                  {
                    participant_id: "fra",
                    probability: 0.5
                  },
                  {
                    participant_id: "sen",
                    probability: 0.5
                  }
                ],
                win_probability_changes: [
                  {
                    participant_id: "fra",
                    last_interval: 0
                  },
                  {
                    participant_id: "sen",
                    last_interval: 0
                  }
                ],
                comeback_probability: 0.5,
                upset_probability: 0.5,
                draw_probability: 0.33,
                overtime_or_tiebreak_probability: 0,
                likely_next_major_event: "kickoff",
                expected_remaining_duration_minutes: 0,
                prediction_confidence: 0.2
              },
              summary: {
                headline: "Scheduled for today",
                short_byte: "No verified live action yet.",
                key_points: ["Awaiting live feed"]
              },
              freshness: {
                generated_at: "2026-06-17T01:00:00Z",
                source_observation_time: "2026-06-17T01:00:00Z",
                age_seconds: 0
              },
              verification: {
                status: "partially_verified",
                confidence: 0.28,
                warnings: ["Schedule-only evidence"]
              }
            },
            freshness: {
              context_generated_at: "2026-06-17T01:00:00Z",
              state_generated_at: "2026-06-17T01:00:00Z",
              context_age_seconds: 0,
              state_age_seconds: 0
            }
          }
        ],
        warnings: []
      })
    );
    const provider = new OpenAiLiveEventDiscoveryProvider(transport);

    const result = await provider.discover({
      region: "north-america",
      sport: "soccer",
      include_context: true,
      known_matches: []
    });

    expect(result.events).toHaveLength(0);
    expect(result.warnings[0]).toContain("excluded from live results");
    expect(result.provider_debug?.openai_web_search?.tool_invoked).toBe(true);
  });

  it("normalizes percent-style probability fields before live-state validation", async () => {
    const transport = createTransport(() =>
      withWebSearchMetadata({
        states: [
          {
            match_id: "basketball:test:demo",
            match_status: "live",
            period: {
              code: "fourth_quarter",
              display: "4th Quarter"
            },
            clock: {
              display: "01:12",
              elapsed_seconds: 100,
              remaining_seconds: 72
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
                  display_score: "101",
                  numeric_score: 101
                }
              ],
              display: "102-101",
              score_differential: 1
            },
            sport_specific: {
              quarter: 4,
              shot_clock_seconds: 11,
              foul_pressure: "away_bonus_watch",
              phase: null,
              stoppage_time_minutes: null,
              pressure_side: null
            },
            current_possession_or_control: {
              participant_id: "bos",
              description: "Boston has the ball."
            },
            what_is_happening: {
              headline: "Late-game possession",
              summary: "Boston is working a decisive set.",
              situation_code: "close_finish",
              key_entity_ids: ["bos", "gsw"]
            },
            last_major_event: {
              event_id: "evt_3",
              event_type: "score",
              participant_id: "bos",
              player_id: "bos-9",
              description: "Boston regained the lead.",
              match_time: "01:12",
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
              aggregate_score: 92,
              level: "high",
              current_excitement: 93,
              recent_excitement: 90,
              expected_remaining_excitement: 95,
              reason_codes: ["close_score"]
            },
            criticality: {
              score: 88,
              level: "high",
              reason_codes: ["late_match"]
            },
            competitive_balance: {
              score: 94,
              level: "very_close"
            },
            momentum: {
              leading_participant_id: "bos",
              score: 76,
              direction: "increasing",
              summary: "Boston has the edge.",
              reason_codes: ["recent_scoring_run"]
            },
            live_predictions: {
              win_probabilities: [
                {
                  participant_id: "bos",
                  probability: 58
                },
                {
                  participant_id: "gsw",
                  probability: 42
                }
              ],
              win_probability_changes: [
                {
                  participant_id: "bos",
                  last_interval: 6
                },
                {
                  participant_id: "gsw",
                  last_interval: -6
                }
              ],
              comeback_probability: 42,
              upset_probability: 29,
              draw_probability: 1,
              overtime_or_tiebreak_probability: 11,
              likely_next_major_event: "score",
              expected_remaining_duration_minutes: 2,
              prediction_confidence: 82
            },
            summary: {
              headline: "A close finish remains live",
              short_byte: "Boston 102, Golden State 101.",
              key_points: ["One score can flip the game"]
            },
            freshness: {
              generated_at: "2026-06-17T01:00:00Z",
              source_observation_time: "2026-06-17T00:59:30Z",
              age_seconds: 0
            },
            verification: {
              status: "verified",
              confidence: 82,
              warnings: []
            }
          }
        ],
        failed_matches: [],
        warnings: []
      })
    );
    const provider = new OpenAiLiveEventStateProvider(transport);

    const result = await provider.refreshStates({
      region: "north-america",
      sport: "basketball",
      matches: [
        {
          match_id: "basketball:test:demo",
          sport: "basketball",
          tournament_name: "NBA",
          scheduled_start_time: "2026-06-16T19:00:00.000Z",
          participants: [
            {
              participant_id: "bos",
              name: "Boston Celtics",
              short_name: "BOS"
            },
            {
              participant_id: "gsw",
              name: "Golden State Warriors",
              short_name: "GSW"
            }
          ]
        }
      ]
    });

    expect(result.states).toHaveLength(1);
    expect(result.states[0]?.live_predictions.prediction_confidence).toBe(0.82);
    expect(
      result.states[0]?.live_predictions.win_probabilities[0]?.probability
    ).toBe(0.58);
    expect(result.states[0]?.verification.confidence).toBe(0.82);
  });

  it("rejects responses that do not contain a web search call", async () => {
    const transport = createTransport(() =>
      withWebSearchMetadata(
        {
          events: [],
          warnings: []
        },
        {
          tool_invoked: false,
          call_count: 0,
          source_count: 0,
          sources: []
        }
      )
    );
    const provider = new OpenAiLiveEventDiscoveryProvider(transport);

    const result = await provider.discover({
      region: "north-america",
      sport: "soccer",
      include_context: true,
      known_matches: []
    });

    expect(result.events).toHaveLength(0);
    expect(result.warnings[0]).toContain("no web_search_call");
    expect(result.provider_debug?.openai_web_search?.tool_invoked).toBe(false);
  });
});
