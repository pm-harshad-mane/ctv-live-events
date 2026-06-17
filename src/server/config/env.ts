import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let envFileLoaded = false;

const loadLocalEnvFile = (): void => {
  if (envFileLoaded) {
    return;
  }

  envFileLoaded = true;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

const numberValue = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const booleanValue = (
  value: string | undefined,
  fallback: boolean
): boolean => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
};

const listValue = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export type AppEnv = {
  port: number;
  publicApiAccess: boolean;
  allowedApiOrigins: string[];
  externalApiKeys: string[];
  openAiApiKey: string | null;
  openAiModel: string;
  openAiRequestTimeoutMs: number;
  defaultRegion: string;
  defaultUpcomingDays: number;
  maxUpcomingDays: number;
  maxUpcomingEvents: number;
  liveStateRefreshSeconds: number;
  liveDiscoveryRefreshSeconds: number;
  liveContextRefreshMinutes: number;
  maxLiveEvents: number;
  maxConcurrentAiRequests: number;
  aiEnabled: boolean;
  aiDisabledRetryAfterSeconds: number;
  useMockData: boolean;
};

export const getEnv = (): AppEnv => {
  loadLocalEnvFile();

  const useMockData = booleanValue(process.env.USE_MOCK_DATA, true);
  const isLocalDevelopment = process.env.NODE_ENV !== "production";
  const publicApiAccessDefault = useMockData && isLocalDevelopment;

  return {
    port: numberValue(process.env.PORT, 8787),
    publicApiAccess: booleanValue(
      process.env.PUBLIC_API_ACCESS,
      publicApiAccessDefault
    ),
    allowedApiOrigins: listValue(process.env.ALLOWED_API_ORIGINS),
    externalApiKeys: listValue(process.env.EXTERNAL_API_KEYS),
    openAiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
    openAiRequestTimeoutMs: numberValue(
      process.env.OPENAI_REQUEST_TIMEOUT_MS,
      45000
    ),
    defaultRegion: process.env.DEFAULT_REGION ?? "north-america",
    defaultUpcomingDays: numberValue(process.env.DEFAULT_UPCOMING_DAYS, 7),
    maxUpcomingDays: numberValue(process.env.MAX_UPCOMING_DAYS, 30),
    maxUpcomingEvents: numberValue(process.env.MAX_UPCOMING_EVENTS, 100),
    liveStateRefreshSeconds: numberValue(
      process.env.LIVE_STATE_REFRESH_SECONDS,
      60
    ),
    liveDiscoveryRefreshSeconds: numberValue(
      process.env.LIVE_DISCOVERY_REFRESH_SECONDS,
      300
    ),
    liveContextRefreshMinutes: numberValue(
      process.env.LIVE_CONTEXT_REFRESH_MINUTES,
      30
    ),
    maxLiveEvents: numberValue(process.env.MAX_LIVE_EVENTS, 50),
    maxConcurrentAiRequests: numberValue(
      process.env.MAX_CONCURRENT_AI_REQUESTS,
      3
    ),
    aiEnabled: booleanValue(process.env.AI_ENABLED, true),
    aiDisabledRetryAfterSeconds: numberValue(
      process.env.AI_DISABLED_RETRY_AFTER_SECONDS,
      300
    ),
    useMockData
  };
};
