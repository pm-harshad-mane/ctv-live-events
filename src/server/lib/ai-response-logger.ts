import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppEnv } from "../config/env";
import type { RequestOrigin } from "../../shared/schemas/live";

type AiProvider = "openai" | "gemini";

type AiResponseLogEntry = {
  provider: AiProvider;
  model: string;
  schema_name: string;
  phase: "success" | "api_error" | "parse_error";
  request: {
    instructions: string;
    input: string;
    request_origin?: RequestOrigin;
    max_output_tokens?: number;
    tools?: Array<Record<string, unknown>>;
    tool_choice?: string;
    include?: string[];
  };
  raw_response_body?: string;
  api_payload?: unknown;
  structured_output?: unknown;
  metadata?: unknown;
  error?: {
    message: string;
    status?: number;
    payload?: unknown;
  };
};

const sanitizePathToken = (value: string): string =>
  value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
  "unknown";

const inferEventFolder = (entry: AiResponseLogEntry): string => {
  const structured = entry.structured_output;
  if (structured && typeof structured === "object") {
    const candidate = structured as Record<string, unknown>;
    if (typeof candidate.match_id === "string") {
      return sanitizePathToken(candidate.match_id);
    }

    if (Array.isArray(candidate.events)) {
      if (candidate.events.length === 1) {
        const onlyEvent = candidate.events[0];
        if (
          onlyEvent &&
          typeof onlyEvent === "object" &&
          "match_id" in onlyEvent &&
          typeof (onlyEvent as Record<string, unknown>).match_id === "string"
        ) {
          return sanitizePathToken(
            (onlyEvent as Record<string, unknown>).match_id as string
          );
        }
      }

      if (candidate.events.length > 1) {
        return "multi-event";
      }
    }

    if (Array.isArray(candidate.states)) {
      if (candidate.states.length === 1) {
        const onlyState = candidate.states[0];
        if (
          onlyState &&
          typeof onlyState === "object" &&
          "match_id" in onlyState &&
          typeof (onlyState as Record<string, unknown>).match_id === "string"
        ) {
          return sanitizePathToken(
            (onlyState as Record<string, unknown>).match_id as string
          );
        }
      }

      if (candidate.states.length > 1) {
        return "multi-event";
      }
    }
  }

  const requestMatchId = entry.request.input.match(
    /"match_id"\s*:\s*"([^"]+)"/
  )?.[1];
  if (requestMatchId) {
    return sanitizePathToken(requestMatchId);
  }

  return "unknown-event";
};

export const writeAiResponseLog = async (
  env: AppEnv,
  entry: AiResponseLogEntry
): Promise<void> => {
  if (!env.storeAiResponses) {
    return;
  }

  try {
    const dayFolder = new Date().toISOString().slice(0, 10);
    const eventFolder = inferEventFolder(entry);
    const outputDir = resolve(
      process.cwd(),
      env.aiResponseLogDir,
      dayFolder,
      eventFolder
    );
    await mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const nonce = Math.random().toString(36).slice(2, 8);
    const fileName = `${timestamp}-${sanitizePathToken(
      entry.provider
    )}-${sanitizePathToken(entry.schema_name)}-${sanitizePathToken(
      entry.phase
    )}-${nonce}.json`;
    const filePath = resolve(outputDir, fileName);

    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          logged_at: new Date().toISOString(),
          ...entry
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } catch (error) {
    console.warn("Failed to persist AI response log.", error);
  }
};
