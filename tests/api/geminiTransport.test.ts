import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../src/server/config/env";

const requestMock = vi.fn();

vi.mock("node:https", () => ({
  default: {
    request: requestMock
  }
}));

const createEnv = (): AppEnv => ({
  port: 8787,
  publicApiAccess: true,
  allowedApiOrigins: [],
  externalApiKeys: [],
  openAiApiKey: null,
  openAiModel: "gpt-4.1-mini",
  openAiDisplayLabel: "ChatGPT",
  geminiApiKey: "test-gemini-key",
  geminiModel: "gemini-3.5-flash",
  geminiDisplayLabel: "Gemini 3",
  mockDisplayLabel: "MockData",
  enabledProviderModes: ["gemini"],
  defaultProviderMode: "gemini",
  openAiRequestTimeoutMs: 45000,
  geminiRequestTimeoutMs: 90000,
  geminiMaxOutputTokens: 12000,
  defaultRegion: "north-america",
  defaultUpcomingDays: 7,
  maxUpcomingDays: 30,
  maxUpcomingEvents: 100,
  liveStateRefreshSeconds: 60,
  liveDiscoveryRefreshSeconds: 300,
  liveContextRefreshMinutes: 30,
  maxLiveEvents: 50,
  maxConcurrentAiRequests: 3,
  aiEnabled: true,
  aiDisabledRetryAfterSeconds: 300,
  useMockData: false,
  storeAiResponses: false,
  aiResponseLogDir: "logs/ai-responses",
  disableAiOutputTokenLimits: false
});

describe("Gemini transport", () => {
  afterEach(() => {
    requestMock.mockReset();
  });

  it("omits generationConfig.maxOutputTokens when the env flag disables output token limits", async () => {
    let writtenBody = "";
    requestMock.mockImplementation((_options, callback) => {
      const response = new EventEmitter() as EventEmitter & {
        statusCode?: number;
        setEncoding: (encoding: string) => void;
      };
      response.statusCode = 200;
      response.setEncoding = () => {};

      const request = new EventEmitter() as EventEmitter & {
        setTimeout: (ms: number, cb: () => void) => void;
        write: (chunk: string) => void;
        end: () => void;
      };
      request.setTimeout = (_ms, _cb) => {};
      request.write = (chunk: string) => {
        writtenBody += chunk;
      };
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"events":[],"warnings":[]}'
                    }
                  ]
                },
                groundingMetadata: {
                  groundingChunks: [],
                  webSearchQueries: []
                }
              }
            ]
          })
        );
        response.emit("end");
      };
      return request;
    });

    const { GeminiStructuredTransport } = await import(
      "../../src/server/gemini/transport"
    );
    const transport = new GeminiStructuredTransport({
      ...createEnv(),
      disableAiOutputTokenLimits: true
    });
    await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      maxOutputTokens: 12345,
      schema: {
        name: "live_discovery_response",
        schema: { type: "object" }
      },
      tools: [{ type: "web_search" }]
    });

    const payload = JSON.parse(writtenBody);
    expect(payload.generationConfig.maxOutputTokens).toBeUndefined();
  });

  it("repairs truncated live_state_refresh_response text when complete states are present", async () => {
    requestMock.mockImplementation((_options, callback) => {
      const response = new EventEmitter() as EventEmitter & {
        statusCode?: number;
        setEncoding: (encoding: string) => void;
      };
      response.statusCode = 200;
      response.setEncoding = () => {};

      const request = new EventEmitter() as EventEmitter & {
        setTimeout: (ms: number, cb: () => void) => void;
        write: (_chunk: string) => void;
        end: () => void;
      };
      request.setTimeout = (_ms, _cb) => {};
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text:
                        '{"states":[{"match_id":"wc2026_eng_gha","match_status":"live","period":{"code":"1H","display":"1st Half"},"clock":{"display":"21:00","elapsed_seconds":1260,"remaining_seconds":1440},"score":{"participant_scores":[{"participant_id":"eng","display_score":"1","numeric_score":1},{"participant_id":"gha","display_score":"0","numeric_score":0}],"display":"1-0","score_differential":1},"sport_specific":{"phase":"first_half"},"current_possession_or_control":{"participant_id":"eng","description":"England controlling possession."},"active_players":[],"what_is_happening":{"headline":"England lead Ghana.","summary":"England are ahead in the first half.","situation_code":"active_play","key_entity_ids":["eng","gha"]},"last_major_event":{"event_id":"goal-1","event_type":"goal","participant_id":"eng","player_id":null,"description":"England scored.","match_time":"18\'","event_importance":72},"recent_events":[],"special_state":{"is_timeout":false,"is_under_review":false,"is_injury_delay":false,"is_weather_delay":false,"is_overtime_or_tiebreak":false,"is_paused":false,"is_postponed":false,"is_cancelled":false,"is_suspended":false,"pause_reason":null,"status_reason":null},"excitement":{"aggregate_score":65,"level":"moderate","current_excitement":64,"recent_excitement":60,"expected_remaining_excitement":67,"reason_codes":["lead_change_threat"]},"criticality":{"score":70,"level":"high","reason_codes":["group_stage"]},"competitive_balance":{"score":62,"level":"competitive"},"watchability":{"current_score":68,"tension_score":72,"scoring_imminence_score":55,"swing_potential_score":61,"state_clarity_score":88,"evidence_strength_score":92},"cross_phase_scores":{"stakes_score":84,"star_power_score":79,"upset_potential_score":28,"narrative_strength_score":76},"momentum":{"leading_participant_id":"eng","score":66,"direction":"up","summary":"England are on top.","reason_codes":["territory"]},"live_predictions":{"win_probabilities":[{"participant_id":"eng","probability":0.71},{"participant_id":"gha","probability":0.11}],"win_probability_changes":[{"participant_id":"eng","last_interval":0.03},{"participant_id":"gha","last_interval":-0.02}],"comeback_probability":0.15,"upset_probability":0.12,"draw_probability":0.2,"overtime_or_tiebreak_probability":0,"likely_next_major_event":"England pressure continues","expected_remaining_duration_minutes":50,"prediction_confidence":0.81},"summary":{"headline":"England 1-0 Ghana","short_byte":"England lead 1-0.","key_points":["England have the edge."]},"freshness":{"generated_at":"2026-06-24T00:00:00Z","source_observation_time":"2026-06-24T00:00:00Z","age_seconds":8},"sources":[{"title":"ESPN Match Center","url":"https://example.com/espn","domain":"espn.com","provider":"Google Search"}],"verification":{"status":"verified","confidence":0.89,"warnings":[]}}]'
                    }
                  ]
                },
                groundingMetadata: {
                  groundingChunks: [],
                  webSearchQueries: []
                }
              }
            ]
          })
        );
        response.emit("end");
      };
      return request;
    });

    const { GeminiStructuredTransport } = await import(
      "../../src/server/gemini/transport"
    );
    const transport = new GeminiStructuredTransport(createEnv());
    const response = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "live_state_refresh_response",
        schema: { type: "object" }
      },
      tools: [{ type: "web_search" }]
    });

    expect(response).toMatchObject({
      states: [
        {
          match_id: "wc2026_eng_gha",
          match_status: "live"
        }
      ],
      failed_matches: [],
      warnings: []
    });
  });
});
