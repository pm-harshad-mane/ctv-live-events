import https from "node:https";
import type { AppEnv } from "../config/env";
import { writeAiResponseLog } from "../lib/ai-response-logger";
import type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../structured-output/types";

export class GeminiApiError extends Error {
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

  if (typeof error.message === "string") {
    return error.message;
  }

  if (typeof error.status === "string") {
    return error.status;
  }

  return null;
};

type GeminiGroundingMetadata = {
  web_search: {
    tool_invoked: boolean;
    query_count: number;
    source_count: number;
    sources: Array<{
      title: string;
      url?: string;
      domain?: string;
      provider?: string;
    }>;
    finish_reason?: string;
    response_preview?: string;
  };
};

const previewText = (value: string, maxLength = 280): string => {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength)}...`;
};

const unwrapJsonText = (value: string): string => {
  const trimmed = value.trim().replace(/^\uFEFF/, "");
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return trimmed;
};

const extractJsonFragment = (value: string): string | null => {
  const trimmed = unwrapJsonText(value);
  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");

  let start = -1;
  let closing = "";

  if (objectStart >= 0 && (arrayStart === -1 || objectStart < arrayStart)) {
    start = objectStart;
    closing = "}";
  } else if (arrayStart >= 0) {
    start = arrayStart;
    closing = "]";
  }

  if (start === -1) {
    return null;
  }

  const end = trimmed.lastIndexOf(closing);
  if (end <= start) {
    return null;
  }

  return trimmed.slice(start, end + 1);
};

const extractGroundingMetadata = (
  payload: unknown
): GeminiGroundingMetadata => {
  if (!payload || typeof payload !== "object") {
    return {
      web_search: {
        tool_invoked: false,
        query_count: 0,
        source_count: 0,
        sources: []
      }
    };
  }

  const candidates =
    "candidates" in payload && Array.isArray(payload.candidates)
      ? payload.candidates
      : [];
  const candidate =
    candidates.length > 0 && candidates[0] && typeof candidates[0] === "object"
      ? (candidates[0] as Record<string, unknown>)
      : null;
  const finishReason =
    candidate && typeof candidate.finishReason === "string"
      ? candidate.finishReason
      : undefined;
  const groundingMetadata =
    candidate &&
    "groundingMetadata" in candidate &&
    candidate.groundingMetadata &&
    typeof candidate.groundingMetadata === "object"
      ? (candidate.groundingMetadata as Record<string, unknown>)
      : null;

  const sourceLabels = new Set<string>();
  const normalizedSources = new Map<
    string,
    { title: string; url?: string; domain?: string; provider?: string }
  >();
  const groundingChunks =
    groundingMetadata &&
    "groundingChunks" in groundingMetadata &&
    Array.isArray(groundingMetadata.groundingChunks)
      ? groundingMetadata.groundingChunks
      : [];
  const webSearchQueries =
    groundingMetadata &&
    "webSearchQueries" in groundingMetadata &&
    Array.isArray(groundingMetadata.webSearchQueries)
      ? groundingMetadata.webSearchQueries
      : [];
  const responsePreview = (() => {
    try {
      return previewText(extractOutputText(payload));
    } catch {
      return undefined;
    }
  })();

  for (const chunk of groundingChunks) {
    if (!chunk || typeof chunk !== "object") {
      continue;
    }

    const web =
      "web" in chunk && chunk.web && typeof chunk.web === "object"
        ? (chunk.web as Record<string, unknown>)
        : null;

    if (!web) {
      continue;
    }

    const normalizedSource = {
      title:
        (typeof web.title === "string"
          ? web.title
          : typeof web.uri === "string"
            ? web.uri
            : typeof web.domain === "string"
              ? web.domain
              : null) ?? "Unknown source",
      url: typeof web.uri === "string" ? web.uri : undefined,
      domain: typeof web.domain === "string" ? web.domain : undefined,
      provider: "Google Search"
    };

    if (normalizedSource.title) {
      sourceLabels.add(normalizedSource.title);
      normalizedSources.set(normalizedSource.title, normalizedSource);
    }
  }

  return {
    web_search: {
      tool_invoked: groundingMetadata !== null,
      query_count: webSearchQueries.length,
      source_count: sourceLabels.size,
      sources: Array.from(normalizedSources.values()),
      finish_reason: finishReason,
      response_preview: responsePreview
    }
  };
};

const extractOutputText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini response payload was not an object.");
  }

  const candidates =
    "candidates" in payload && Array.isArray(payload.candidates)
      ? payload.candidates
      : [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const content =
      "content" in candidate &&
      candidate.content &&
      typeof candidate.content === "object"
        ? (candidate.content as Record<string, unknown>)
        : null;

    const parts =
      content && "parts" in content && Array.isArray(content.parts)
        ? content.parts
        : [];

    for (const part of parts) {
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
    }
  }

  throw new Error("Gemini response did not include text content.");
};

const parseGeminiApiPayload = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `Gemini returned an invalid API JSON payload: ${previewText(raw)}`
    );
  }
};

const parseStructuredJsonText = (text: string): unknown => {
  const directCandidate = unwrapJsonText(text);

  try {
    return JSON.parse(directCandidate) as unknown;
  } catch {
    const fragment = extractJsonFragment(text);
    if (fragment) {
      try {
        return JSON.parse(fragment) as unknown;
      } catch {
        // fall through to clearer error below
      }
    }

    throw new Error(
      `Gemini returned non-JSON structured text: ${previewText(text)}`
    );
  }
};

export class GeminiStructuredTransport implements StructuredResponseTransport {
  constructor(private readonly env: AppEnv) {}

  async createStructuredResponse(
    request: StructuredResponseRequest
  ): Promise<unknown> {
    const apiKey = this.env.geminiApiKey;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required when Gemini mode is selected."
      );
    }

    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      responseJsonSchema: request.schema.schema
    };

    if (!this.env.disableAiOutputTokenLimits) {
      generationConfig.maxOutputTokens =
        request.maxOutputTokens ?? this.env.geminiMaxOutputTokens;
    }

    const body = JSON.stringify({
      system_instruction: {
        parts: [{ text: request.instructions }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: request.input }]
        }
      ],
      tools:
        request.tools && request.tools.length > 0
          ? request.tools.map((tool) =>
              tool.type === "web_search" ? { google_search: {} } : tool
            )
          : undefined,
      generationConfig
    });

    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const req = https.request(
          {
            method: "POST",
            hostname: "generativelanguage.googleapis.com",
            path: `/v1beta/models/${this.env.geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
            headers: {
              "x-goog-api-key": apiKey,
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
                  new GeminiApiError(
                    extractApiErrorMessage(parsed) ??
                      `Gemini API request failed with status ${response.statusCode}.`,
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

        req.setTimeout(this.env.geminiRequestTimeoutMs, () => {
          req.destroy(
            new Error(
              `Gemini request timed out after ${this.env.geminiRequestTimeoutMs}ms.`
            )
          );
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });

      const parsed = parseGeminiApiPayload(raw);
      const text = extractOutputText(parsed);
      if (text.trim().length === 0) {
        throw new Error(
          "Gemini returned an empty structured response after search grounding."
        );
      }

      const structured = parseStructuredJsonText(text);
      const metadata = extractGroundingMetadata(parsed);

      await writeAiResponseLog(this.env, {
        provider: "gemini",
        model: this.env.geminiModel,
        schema_name: request.schema.name,
        phase: "success",
        request: {
          instructions: request.instructions,
          input: request.input,
          request_origin: request.requestOrigin,
          max_output_tokens: request.maxOutputTokens,
          tools: request.tools,
          tool_choice: request.toolChoice,
          include: request.include
        },
        raw_response_body: raw,
        api_payload: parsed,
        structured_output: structured,
        metadata
      });

      if (structured && typeof structured === "object") {
        return {
          ...structured,
          _gemini_metadata: metadata
        } as Record<string, unknown>;
      }

      return structured;
    } catch (error) {
      await writeAiResponseLog(this.env, {
        provider: "gemini",
        model: this.env.geminiModel,
        schema_name: request.schema.name,
        phase: error instanceof GeminiApiError ? "api_error" : "parse_error",
        request: {
          instructions: request.instructions,
          input: request.input,
          request_origin: request.requestOrigin,
          max_output_tokens: request.maxOutputTokens,
          tools: request.tools,
          tool_choice: request.toolChoice,
          include: request.include
        },
        error: {
          message: error instanceof Error ? error.message : "Unknown Gemini error.",
          status: error instanceof GeminiApiError ? error.status : undefined,
          payload: error instanceof GeminiApiError ? error.payload : undefined
        }
      });
      throw error;
    }
  }
}
