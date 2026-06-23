import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/server/config/env";
import { writeAiResponseLog } from "../../src/server/lib/ai-response-logger";

const createdDirs: string[] = [];

const createEnv = (overrides: Partial<AppEnv> = {}): AppEnv => ({
  port: 8787,
  publicApiAccess: true,
  allowedApiOrigins: [],
  externalApiKeys: [],
  openAiApiKey: null,
  openAiModel: "gpt-5-mini",
  openAiDisplayLabel: "ChatGPT 4.5 mini",
  geminiApiKey: null,
  geminiModel: "gemini-3.5-flash",
  geminiDisplayLabel: "Gemini 3",
  mockDisplayLabel: "MockData",
  enabledProviderModes: ["mock"],
  defaultProviderMode: "mock",
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
  useMockData: true,
  storeAiResponses: false,
  aiResponseLogDir: "logs/ai-responses",
  disableAiOutputTokenLimits: false,
  ...overrides
});

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("AI response logger", () => {
  it("does not write logs when disabled", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "ai-log-disabled-"));
    createdDirs.push(baseDir);

    await writeAiResponseLog(
      createEnv({
        storeAiResponses: false,
        aiResponseLogDir: join(baseDir, "logs")
      }),
      {
        provider: "openai",
        model: "gpt-5-mini",
        schema_name: "live_discovery_response",
        phase: "success",
        request: {
          instructions: "test",
          input: "test"
        },
        structured_output: { ok: true }
      }
    );

    expect(() => readdirSync(join(baseDir, "logs"))).toThrow();
  });

  it("writes logs when enabled", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "ai-log-enabled-"));
    createdDirs.push(baseDir);
    const logDir = join(baseDir, "logs");

    await writeAiResponseLog(
      createEnv({
        storeAiResponses: true,
        aiResponseLogDir: logDir
      }),
      {
        provider: "gemini",
        model: "gemini-3.5-flash",
        schema_name: "live_state_response",
        phase: "success",
        request: {
          instructions: "system prompt",
          input: "user input",
          request_origin: "tracker"
        },
        metadata: { grounded: true },
        structured_output: { match_id: "abc" }
      }
    );

    const dayDirs = readdirSync(logDir);
    expect(dayDirs).toHaveLength(1);
    const eventDirs = readdirSync(join(logDir, dayDirs[0]));
    expect(eventDirs).toEqual(["abc"]);
    const files = readdirSync(join(logDir, dayDirs[0], eventDirs[0]));
    expect(files).toHaveLength(1);
    const payload = JSON.parse(
      readFileSync(join(logDir, dayDirs[0], eventDirs[0], files[0]), "utf8")
    );
    expect(payload.provider).toBe("gemini");
    expect(payload.schema_name).toBe("live_state_response");
    expect(payload.request.instructions).toBe("system prompt");
    expect(payload.request.request_origin).toBe("tracker");
    expect(payload.structured_output.match_id).toBe("abc");
  });
});
