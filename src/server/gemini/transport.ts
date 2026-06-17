import https from "node:https";
import type { AppEnv } from "../config/env";
import type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../openai/transport";

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
    sources: string[];
  };
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
  const groundingMetadata =
    candidate &&
    "groundingMetadata" in candidate &&
    candidate.groundingMetadata &&
    typeof candidate.groundingMetadata === "object"
      ? (candidate.groundingMetadata as Record<string, unknown>)
      : null;

  const sourceLabels = new Set<string>();
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

    const labelCandidates = [
      typeof web.title === "string" ? web.title : null,
      typeof web.uri === "string" ? web.uri : null,
      typeof web.domain === "string" ? web.domain : null
    ].filter((value): value is string => Boolean(value));

    if (labelCandidates[0]) {
      sourceLabels.add(labelCandidates[0]);
    }
  }

  return {
    web_search: {
      tool_invoked: groundingMetadata !== null,
      query_count: webSearchQueries.length,
      source_count: sourceLabels.size,
      sources: Array.from(sourceLabels)
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
              tool.type === "web_search" ? { googleSearch: {} } : tool
            )
          : undefined,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: request.schema.schema,
        maxOutputTokens: request.maxOutputTokens ?? 4000
      }
    });

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

    const parsed = JSON.parse(raw) as unknown;
    const text = extractOutputText(parsed);
    if (text.trim().length === 0) {
      throw new Error(
        "Gemini returned an empty structured response after search grounding."
      );
    }

    const structured = JSON.parse(text) as unknown;
    const metadata = extractGroundingMetadata(parsed);

    if (structured && typeof structured === "object") {
      return {
        ...structured,
        _gemini_metadata: metadata
      } as Record<string, unknown>;
    }

    return structured;
  }
}
