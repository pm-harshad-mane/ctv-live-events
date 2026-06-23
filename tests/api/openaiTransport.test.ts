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
  openAiApiKey: "test-key",
  openAiModel: "gpt-4.1-mini",
  openAiDisplayLabel: "ChatGPT",
  geminiApiKey: null,
  geminiModel: "gemini-3.5-flash",
  geminiDisplayLabel: "Gemini 3",
  mockDisplayLabel: "MockData",
  enabledProviderModes: ["openai"],
  defaultProviderMode: "openai",
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

const buildPayload = (text: string) => ({
  output: [
    {
      type: "web_search_call",
      action: {
        sources: ["example.com"]
      }
    },
    {
      content: [
        {
          type: "output_text",
          text
        }
      ]
    }
  ]
});

describe("OpenAI transport", () => {
  afterEach(() => {
    requestMock.mockReset();
  });

  it("parses fenced JSON output text", async () => {
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
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify(buildPayload("```json\n{\"events\":[],\"warnings\":[]}\n```"))
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport(createEnv());
    const result = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "live_discovery_response",
        schema: { type: "object" }
      }
    });

    expect(result).toMatchObject({
      events: [],
      warnings: []
    });
  });

  it("parses JSON fragments embedded in output text", async () => {
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
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify(
            buildPayload(
              'Here is the result:\n{"events":[],"warnings":["ok"]}\nEnd of response.'
            )
          )
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport(createEnv());
    const result = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "live_discovery_response",
        schema: { type: "object" }
      }
    });

    expect(result).toMatchObject({
      events: [],
      warnings: ["ok"]
    });
  });

  it("omits max_output_tokens when the env flag disables output token limits", async () => {
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
          JSON.stringify(buildPayload('{"events":[],"warnings":[]}'))
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport({
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
      }
    });

    const payload = JSON.parse(writtenBody);
    expect(payload.max_output_tokens).toBeUndefined();
  });

  it("repairs truncated live discovery JSON missing the warnings tail", async () => {
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
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify(
            buildPayload(
              '{"events":[{"match_id":"demo","context_status":"new","context_fingerprint":"ctx","context":{"match":{"match_id":"demo","match_name":"Demo Match","sport":"soccer","tournament_name":"Cup","tournament_stage":"Group","scheduled_start_time":"2026-06-18T19:00:00Z","venue":{"stadium":"Demo","city":"Atlanta","state":"Georgia","country":"USA"}},"participants":[{"participant_id":"A","name":"Team A","short_name":"A","role":"home","ranking":null,"recent_form":[]}],"pre_match_intelligence":{"headline":"Test","summary":"Test","expected_competitiveness":70,"key_matchup":"Test"},"context_version":1,"context_fingerprint":"ctx","context_generated_at":"2026-06-18T18:00:00Z"},"live_state":{"match_id":"demo","match_status":"live","period":{"code":"1H","display":"1st Half"},"clock":{"display":"00:00","elapsed_seconds":0,"remaining_seconds":5400},"score":{"participant_scores":[{"participant_id":"A","display_score":"0","numeric_score":0}],"display":"0","score_differential":0},"sport_specific":{"phase":"open_play"},"current_possession_or_control":{"participant_id":"A","description":"Team A controlling play"},"active_players":[],"what_is_happening":{"headline":"Test","summary":"Test","situation_code":"open_play","key_entity_ids":["A"]},"last_major_event":{"event_id":"evt1","event_type":"kickoff","participant_id":"A","player_id":null,"description":"Kickoff","match_time":"2026-06-18T19:00:00Z","event_importance":25},"recent_events":[],"special_state":{"is_timeout":false,"is_under_review":false,"is_injury_delay":false,"is_weather_delay":false,"is_overtime_or_tiebreak":false},"excitement":{"aggregate_score":60,"level":"medium","current_excitement":60,"recent_excitement":55,"expected_remaining_excitement":65,"reason_codes":["close_match"]},"criticality":{"score":50,"level":"medium","reason_codes":["group_stage"]},"competitive_balance":{"score":80,"level":"close"},"momentum":{"leading_participant_id":"A","score":55,"direction":"flat","summary":"Balanced","reason_codes":["balanced"]},"live_predictions":{"win_probabilities":[{"participant_id":"A","probability":0.5}],"win_probability_changes":[],"comeback_probability":0.2,"upset_probability":0.1,"draw_probability":0.3,"overtime_or_tiebreak_probability":0,"likely_next_major_event":"attack","expected_remaining_duration_minutes":90,"prediction_confidence":0.7},"summary":{"headline":"Live","short_byte":"Live","key_points":["Test"]},"freshness":{"generated_at":"2026-06-18T18:00:00Z","source_observation_time":"2026-06-18T18:00:00Z","age_seconds":0},"verification":{"status":"verified","confidence":0.9,"warnings":[]}},"freshness":{"context_generated_at":"2026-06-18T18:00:00Z","state_generated_at":"2026-06-18T18:00:00Z","context_age_seconds":0,"state_age_seconds":0}}'
            )
          )
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport(createEnv());
    const result = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "live_discovery_response",
        schema: { type: "object" }
      }
    });

    expect(result).toMatchObject({
      events: [
        {
          match_id: "demo"
        }
      ],
      warnings: []
    });
  });

  it("repairs truncated live discovery JSON when the events array is already closed", async () => {
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
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify(
            buildPayload(
              '{"events":[{"match_id":"demo2","context_status":"new","context_fingerprint":"ctx2","context":{"match":{"match_id":"demo2","match_name":"Demo Match 2","sport":"soccer","tournament_name":"Cup","tournament_stage":"Group","scheduled_start_time":"2026-06-18T19:00:00Z","venue":{"stadium":"Demo","city":"Atlanta","state":"Georgia","country":"USA"}},"participants":[{"participant_id":"A","name":"Team A","short_name":"A","role":"home","ranking":null,"recent_form":[]}],"pre_match_intelligence":{"headline":"Test","summary":"Test","expected_competitiveness":70,"key_matchup":"Test"},"context_version":1,"context_fingerprint":"ctx2","context_generated_at":"2026-06-18T18:00:00Z"},"live_state":{"match_id":"demo2","match_status":"live","period":{"code":"1H","display":"1st Half"},"clock":{"display":"00:00","elapsed_seconds":0,"remaining_seconds":5400},"score":{"participant_scores":[{"participant_id":"A","display_score":"0","numeric_score":0}],"display":"0","score_differential":0},"sport_specific":{"phase":"open_play"},"current_possession_or_control":{"participant_id":"A","description":"Team A controlling play"},"active_players":[],"what_is_happening":{"headline":"Test","summary":"Test","situation_code":"open_play","key_entity_ids":["A"]},"last_major_event":{"event_id":"evt1","event_type":"kickoff","participant_id":"A","player_id":null,"description":"Kickoff","match_time":"2026-06-18T19:00:00Z","event_importance":25},"recent_events":[],"special_state":{"is_timeout":false,"is_under_review":false,"is_injury_delay":false,"is_weather_delay":false,"is_overtime_or_tiebreak":false},"excitement":{"aggregate_score":60,"level":"medium","current_excitement":60,"recent_excitement":55,"expected_remaining_excitement":65,"reason_codes":["close_match"]},"criticality":{"score":50,"level":"medium","reason_codes":["group_stage"]},"competitive_balance":{"score":80,"level":"close"},"momentum":{"leading_participant_id":"A","score":55,"direction":"flat","summary":"Balanced","reason_codes":["balanced"]},"live_predictions":{"win_probabilities":[{"participant_id":"A","probability":0.5}],"win_probability_changes":[],"comeback_probability":0.2,"upset_probability":0.1,"draw_probability":0.3,"overtime_or_tiebreak_probability":0,"likely_next_major_event":"attack","expected_remaining_duration_minutes":90,"prediction_confidence":0.7},"summary":{"headline":"Live","short_byte":"Live","key_points":["Test"]},"freshness":{"generated_at":"2026-06-18T18:00:00Z","source_observation_time":"2026-06-18T18:00:00Z","age_seconds":0},"verification":{"status":"verified","confidence":0.9,"warnings":[]}},"freshness":{"context_generated_at":"2026-06-18T18:00:00Z","state_generated_at":"2026-06-18T18:00:00Z","context_age_seconds":0,"state_age_seconds":0}}]'
            )
          )
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport(createEnv());
    const result = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "live_discovery_response",
        schema: { type: "object" }
      }
    });

    expect(result).toMatchObject({
      events: [
        {
          match_id: "demo2"
        }
      ],
      warnings: []
    });
  });

  it("salvages a late-truncated live discovery event near live_state freshness", async () => {
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
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify(
            buildPayload(
              '{"events":[{"match_id":"2026-06-23-ENG-GHA","context_status":"new","context_fingerprint":"2026-06-23-ENG-GHA","context":{"match":{"match_id":"2026-06-23-ENG-GHA","match_name":"England vs Ghana","sport":"soccer","tournament_name":"FIFA World Cup 2026","tournament_stage":"Group L","scheduled_start_time":"2026-06-23T20:00:00-04:00","venue":{"stadium":"Gillette Stadium","city":"Boston","state":"Massachusetts","country":"USA"}},"participants":[{"participant_id":"ENG","name":"England","short_name":"ENG","role":"home","ranking":null,"recent_form":[]}],"pre_match_intelligence":{"headline":"England faces Ghana in Group L clash","summary":"England takes on Ghana in a crucial Group L match at Gillette Stadium in Boston.","expected_competitiveness":80,"key_matchup":"England midfield vs Ghana defense"},"context_version":1,"context_fingerprint":"2026-06-23-ENG-GHA","context_generated_at":"2026-06-23T16:10:21-04:00"},"live_state":{"match_id":"2026-06-23-ENG-GHA","match_status":"live","period":{"code":"1H","display":"1st Half"},"clock":{"display":"45:00","elapsed_seconds":2700,"remaining_seconds":0},"score":{"participant_scores":[{"participant_id":"ENG","display_score":"1","numeric_score":1},{"participant_id":"GHA","display_score":"0","numeric_score":0}],"display":"1-0","score_differential":1},"sport_specific":{"quarter":null,"shot_clock_seconds":null,"foul_pressure":null,"phase":null,"stoppage_time_minutes":null,"pressure_side":null,"attacking_side":null,"possession_team":"ENG","down":null,"distance_yards":null,"yard_line":null,"red_zone":null,"inning":null,"innings_half":null,"outs":null,"balls":null,"strikes":null,"runners_on_base":null,"over":null,"wickets":null,"run_rate":null,"target_runs":null,"power_play":null,"period_number":1,"pulled_goalie":null,"current_set":null,"set_score":null,"serve_side":null,"break_point_pressure":null,"round":null,"control_time_seconds":null,"finish_threat":null},"current_possession_or_control":{"participant_id":"ENG","description":"England maintains possession in Ghana half."},"active_players":[{"player_id":"ENG-9","player_name":"Harry Kane","participant_id":"ENG","role":"forward","status":"active","impact_summary":"Scored the opening goal.","key_metrics":[{"label":"Goals","value":"1"}]}],"what_is_happening":{"headline":"England leads Ghana 1-0 at halftime","summary":"England leads Ghana 1-0 at halftime.","situation_code":"HALF_TIME","key_entity_ids":["ENG-9"]},"last_major_event":{"event_id":"2026-06-23-ENG-GHA-1","event_type":"goal","participant_id":"ENG","player_id":"ENG-9","description":"Harry Kane scores the opening goal.","match_time":"2026-06-23T20:35:00-04:00","event_importance":80},"recent_events":[{"description":"Harry Kane scores the opening goal.","match_time":"2026-06-23T20:35:00-04:00"}],"special_state":{"is_timeout":false,"is_under_review":false,"is_injury_delay":false,"is_weather_delay":false,"is_overtime_or_tiebreak":false,"is_paused":false,"is_postponed":false,"is_cancelled":false,"is_suspended":false,"pause_reason":null,"status_reason":null},"excitement":{"aggregate_score":75,"level":"high","current_excitement":80,"recent_excitement":70,"expected_remaining_excitement":85,"reason_codes":["goal_scored","close_match"]},"criticality":{"score":80,"level":"high","reason_codes":["must_win_match","tournament_stage"]},"competitive_balance":{"score":70,"level":"medium_high"},"watchability":{"current_score":80,"tension_score":75,"scoring_imminence_score":70,"swing_potential_score":65,"state_clarity_score":90,"evidence_strength_score":95},"cross_phase_scores":{"stakes_score":85,"star_power_score":80,"upset_potential_score":60,"narrative_strength_score":70},"momentum":{"leading_participant_id":"ENG","score":1,"direction":"up","summary":"England has gained momentum after scoring.","reason_codes":["goal_scored"]},"live_predictions":{"win_probabilities":[{"participant_id":"ENG","probability":0.75},{"participant_id":"GHA","probability":0.25}],"win_probability_changes":[{"participant_id":"ENG","last_interval":0.05},{"participant_id":"GHA","last_interval":-0.05}],"comeback_probability":0.25,"upset_probability":0.15,"draw_probability":0.10,"overtime_or_tiebreak_probability":0.05,"likely_next_major_event":"England to score another goal","expected_remaining_duration_minutes":45,"prediction_confidence":0.85},"summary":{"headline":"England leads Ghana 1-0 at halftime","short_byte":"England leads 1-0 at halftime.","key_points":["Harry Kane goal"]},"freshness":{"generated_at":"2026-06-23T16:10:21-04:00","source_observation_time":"202'
            )
          )
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport(createEnv());
    const result = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "live_discovery_response",
        schema: { type: "object" }
      }
    });

    expect(result).toMatchObject({
      events: [
        {
          match_id: "2026-06-23-ENG-GHA",
          live_state: {
            match_status: "live",
            score: {
              display: "1-0"
            }
          }
        }
      ]
    });
  });

  it("salvages complete upcoming events when the response is truncated mid-event", async () => {
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
      request.write = () => {};
      request.end = () => {
        callback(response);
        response.emit(
          "data",
          JSON.stringify(
            buildPayload(
              '{"events":[{"match_id":"up1","context":{"match":{"match_id":"up1","match_name":"Match 1","sport":"soccer","tournament_name":"Cup","tournament_stage":"Group","scheduled_start_time":"2026-06-19T19:00:00Z","venue":{"stadium":"Demo","city":"Atlanta","state":"Georgia","country":"USA"}},"participants":[{"participant_id":"A","name":"Team A","short_name":"A","role":"home","ranking":null,"recent_form":[]}],"pre_match_intelligence":{"headline":"H1","summary":"S1","expected_competitiveness":70,"key_matchup":"K1"},"context_version":1,"context_fingerprint":"fp1","context_generated_at":"2026-06-18T18:00:00Z"},"upcoming_intelligence":{"headline":"UH1","summary":"US1","projected_competitiveness":72,"watch_reasons":["a","b","c"],"win_probabilities":[{"participant_id":"A","probability":0.55}]},"freshness":{"generated_at":"2026-06-18T18:00:00Z","age_seconds":0}},{"match_id":"up2","context":{"match":{"match_id":"up2","match_name":"Match 2","sport":"soccer","tournament_name":"Cup","tournament_stage":"Group","scheduled_start_time":"2026-06-20T19:00:00Z","venue":{"stadium":"Demo","city":"Atlanta","state":"Georgia","country":"USA"}},"participants":[{"participant_id":"B","name":"Team B","short_name":"B","role":"away","ranking":null,"recent_form":[]}],"pre_match_intelligence":{"headline":"H2","summary":"S2","expected_competitiveness":68,"key_matchup":"K2"},"context_version":1,"context_fingerprint":"fp2","context_generated_at":"2026-06-18T18:00:00Z"},"upcoming_intelligence":{"headline":"UH2","summary":"US2","projected_competitiveness":69,"watch_reasons":["d","e","f"],"win_probabilities":[{"participant_id":"B","probability":0.45}]},"freshness":{"generated_at":"2026-06-18T18:00:00Z","age_seconds":0}},{"match_id":"broken","context":{"match":{"match_id":"broken"'
            )
          )
        );
        response.emit("end");
      };
      return request;
    });

    const { OpenAiResponsesTransport } = await import(
      "../../src/server/openai/transport"
    );
    const transport = new OpenAiResponsesTransport(createEnv());
    const result = await transport.createStructuredResponse({
      instructions: "test",
      input: "{}",
      schema: {
        name: "upcoming_events_response",
        schema: { type: "object" }
      }
    });

    expect(result).toMatchObject({
      events: [{ match_id: "up1" }, { match_id: "up2" }],
      warnings: []
    });
  });
});
