import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppEnv } from "../config/env";

type AiProvider = "openai" | "gemini";

type AiResponseLogEntry = {
  provider: AiProvider;
  model: string;
  schema_name: string;
  phase: "success" | "api_error" | "parse_error";
  request: {
    instructions: string;
    input: string;
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

export const writeAiResponseLog = async (
  env: AppEnv,
  entry: AiResponseLogEntry
): Promise<void> => {
  if (!env.storeAiResponses) {
    return;
  }

  try {
    const outputDir = resolve(process.cwd(), env.aiResponseLogDir);
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
