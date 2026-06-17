import https from "node:https";
import type { AppEnv } from "../config/env";
import type { StructuredSchemaDefinition } from "./schemas";

export class OpenAiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown
  ) {
    super(message);
  }
}

const extractApiErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error =
    "error" in payload && payload.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : null;

  if (!error) {
    return null;
  }

  return typeof error.message === "string" ? error.message : null;
};

export type StructuredResponseRequest = {
  instructions: string;
  input: string;
  schema: StructuredSchemaDefinition;
  maxOutputTokens?: number;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: "auto" | "none";
  include?: string[];
};

export interface StructuredResponseTransport {
  createStructuredResponse(
    request: StructuredResponseRequest
  ): Promise<unknown>;
}

type OpenAiWebSearchMetadata = {
  tool_invoked: boolean;
  call_count: number;
  source_count: number;
  sources: string[];
};

type OpenAiStructuredResponseMetadata = {
  web_search: OpenAiWebSearchMetadata;
};

const extractWebSearchMetadata = (
  payload: unknown
): OpenAiStructuredResponseMetadata => {
  if (!payload || typeof payload !== "object") {
    return {
      web_search: {
        tool_invoked: false,
        call_count: 0,
        source_count: 0,
        sources: []
      }
    };
  }

  const output =
    "output" in payload && Array.isArray(payload.output) ? payload.output : [];
  const sourceLabels = new Set<string>();
  let callCount = 0;

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (!("type" in item) || item.type !== "web_search_call") {
      continue;
    }

    callCount += 1;
    const action =
      "action" in item && item.action && typeof item.action === "object"
        ? item.action
        : null;
    const sources =
      action && "sources" in action && Array.isArray(action.sources)
        ? action.sources
        : [];

    for (const source of sources) {
      if (typeof source === "string") {
        sourceLabels.add(source);
        continue;
      }

      if (!source || typeof source !== "object") {
        continue;
      }

      const labelCandidates = [
        "title" in source && typeof source.title === "string"
          ? source.title
          : null,
        "url" in source && typeof source.url === "string" ? source.url : null,
        "domain" in source && typeof source.domain === "string"
          ? source.domain
          : null,
        "source" in source && typeof source.source === "string"
          ? source.source
          : null,
        "provider" in source && typeof source.provider === "string"
          ? source.provider
          : null
      ].filter((value): value is string => Boolean(value));

      if (labelCandidates[0]) {
        sourceLabels.add(labelCandidates[0]);
      }
    }
  }

  return {
    web_search: {
      tool_invoked: callCount > 0,
      call_count: callCount,
      source_count: sourceLabels.size,
      sources: Array.from(sourceLabels)
    }
  };
};

const extractOutputText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload was not an object.");
  }

  const directOutputText =
    "output_text" in payload && typeof payload.output_text === "string"
      ? payload.output_text
      : null;
  if (directOutputText) {
    return directOutputText;
  }

  const output =
    "output" in payload && Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content =
      "content" in item && Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "output_text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
    }
  }

  throw new Error("OpenAI response did not include output_text content.");
};

export class OpenAiResponsesTransport implements StructuredResponseTransport {
  constructor(private readonly env: AppEnv) {}

  async createStructuredResponse(
    request: StructuredResponseRequest
  ): Promise<unknown> {
    if (!this.env.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is required when USE_MOCK_DATA=false.");
    }

    const body = JSON.stringify({
      model: this.env.openAiModel,
      store: false,
      instructions: request.instructions,
      input: request.input,
      max_output_tokens: request.maxOutputTokens ?? 4000,
      tools: request.tools,
      tool_choice: request.toolChoice ?? "none",
      include: request.include,
      text: {
        format: {
          type: "json_schema",
          name: request.schema.name,
          strict: true,
          schema: request.schema.schema
        }
      }
    });

    const raw = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          method: "POST",
          hostname: "api.openai.com",
          path: "/v1/responses",
          headers: {
            Authorization: `Bearer ${this.env.openAiApiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
          }
        },
        (response) => {
          let data = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            data += chunk;
          });
          response.on("end", () => {
            if ((response.statusCode ?? 500) >= 400) {
              let parsed: unknown = data;
              try {
                parsed = JSON.parse(data);
              } catch {
                // keep raw body
              }
              reject(
                new OpenAiApiError(
                  extractApiErrorMessage(parsed) ??
                    `OpenAI API request failed with status ${response.statusCode}.`,
                  response.statusCode ?? 500,
                  parsed
                )
              );
              return;
            }
            resolve(data);
          });
        }
      );

      req.setTimeout(this.env.openAiRequestTimeoutMs, () => {
        req.destroy(
          new Error(
            `OpenAI request timed out after ${this.env.openAiRequestTimeoutMs}ms.`
          )
        );
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    const parsed = JSON.parse(raw) as unknown;
    const metadata = extractWebSearchMetadata(parsed);
    const text = extractOutputText(parsed);
    if (text.trim().length === 0) {
      throw new Error(
        "OpenAI returned an empty structured response after tool execution."
      );
    }
    const structured = JSON.parse(text) as unknown;

    if (structured && typeof structured === "object") {
      return {
        ...structured,
        _openai_metadata: metadata
      } as Record<string, unknown>;
    }

    return structured;
  }
}
