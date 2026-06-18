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
});
