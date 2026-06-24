import https from "node:https";
import type { AppEnv } from "../config/env";
import { writeAiResponseLog } from "../lib/ai-response-logger";
import type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../structured-output/types";

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

export type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../structured-output/types";

type OpenAiWebSearchMetadata = {
  tool_invoked: boolean;
  call_count: number;
  source_count: number;
  sources: Array<{
    title: string;
    url?: string;
    domain?: string;
    provider?: string;
  }>;
};

type OpenAiStructuredResponseMetadata = {
  web_search: OpenAiWebSearchMetadata;
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

const extractCompleteTopLevelObjects = (
  value: string,
  arrayKey: "events" | "states"
): string[] => {
  const marker = `{"${arrayKey}":[`;
  const trimmed = unwrapJsonText(value).trim();
  const start = trimmed.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const arrayStart = start + marker.length;
  const objects: string[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escape = false;

  for (let index = arrayStart; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (character === "\\") {
        escape = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}") {
      if (depth === 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(trimmed.slice(objectStart, index + 1));
        objectStart = -1;
      }
      continue;
    }
  }

  return objects;
};

const salvageLateTruncatedLiveDiscoveryEvent = (
  value: string
): string | null => {
  const trimmed = unwrapJsonText(value).trim();
  if (!trimmed.startsWith('{"events":[{')) {
    return null;
  }

  if (
    !trimmed.includes('"live_state":{') ||
    !trimmed.includes('"summary":{') ||
    trimmed.includes('"verification":{')
  ) {
    return null;
  }

  const liveStateFreshnessIndex = trimmed.lastIndexOf(',"freshness":{');
  if (liveStateFreshnessIndex === -1) {
    return null;
  }

  const generatedAtMatch = trimmed.match(
    /"context_generated_at":"([^"]+)"/
  );
  const inferredTimestamp =
    generatedAtMatch?.[1] ?? new Date().toISOString();

  const eventBody = trimmed.slice(0, liveStateFreshnessIndex);
  return `${eventBody},"freshness":{"generated_at":"${inferredTimestamp}","source_observation_time":"${inferredTimestamp}","age_seconds":0},"verification":{"status":"partially_verified","confidence":0.5,"warnings":["Recovered from truncated provider response."]}},"freshness":{"context_generated_at":"${inferredTimestamp}","state_generated_at":"${inferredTimestamp}","context_age_seconds":0,"state_age_seconds":0}}],"warnings":["Recovered truncated live discovery response."]}`;
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
  const normalizedSources = new Map<
    string,
    { title: string; url?: string; domain?: string; provider?: string }
  >();
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
        normalizedSources.set(source, { title: source });
        continue;
      }

      if (!source || typeof source !== "object") {
        continue;
      }

      const normalizedSource = {
        title:
          ("title" in source && typeof source.title === "string"
            ? source.title
            : "source" in source && typeof source.source === "string"
              ? source.source
              : "url" in source && typeof source.url === "string"
                ? source.url
                : "domain" in source && typeof source.domain === "string"
                  ? source.domain
                  : "provider" in source && typeof source.provider === "string"
                    ? source.provider
                    : null) ?? "Unknown source",
        url: "url" in source && typeof source.url === "string" ? source.url : undefined,
        domain:
          "domain" in source && typeof source.domain === "string"
            ? source.domain
            : undefined,
        provider:
          "provider" in source && typeof source.provider === "string"
            ? source.provider
            : undefined
      };

      if (normalizedSource.title) {
        sourceLabels.add(normalizedSource.title);
        normalizedSources.set(normalizedSource.title, normalizedSource);
      }
    }
  }

  return {
    web_search: {
      tool_invoked: callCount > 0,
      call_count: callCount,
      source_count: sourceLabels.size,
      sources: Array.from(normalizedSources.values())
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

const buildSchemaRepairCandidates = (
  text: string,
  schemaName: string
): string[] => {
  const trimmed = unwrapJsonText(text).trimEnd();
  const candidates = new Set<string>();

  if (
    schemaName === "live_discovery_response" ||
    schemaName === "upcoming_events_response"
  ) {
    if (
      trimmed.startsWith('{"events":[') &&
      !trimmed.includes('],"warnings"')
    ) {
      if (trimmed.endsWith("}]")) {
        candidates.add(`${trimmed},"warnings":[]}`);
      } else {
        candidates.add(`${trimmed}],"warnings":[]}`);
      }
    }

    const completeEvents = extractCompleteTopLevelObjects(text, "events");
    if (completeEvents.length > 0) {
      candidates.add(
        `{"events":[${completeEvents.join(",")}],"warnings":[]}`
      );
    }

    if (schemaName === "live_discovery_response") {
      const salvagedEvent = salvageLateTruncatedLiveDiscoveryEvent(text);
      if (salvagedEvent) {
        candidates.add(salvagedEvent);
      }
    }
  }

  if (schemaName === "live_state_refresh_response") {
    if (
      trimmed.startsWith('{"states":[') &&
      !trimmed.includes('],"failed_matches"') &&
      !trimmed.includes('],"warnings"')
    ) {
      if (trimmed.endsWith("}]")) {
        candidates.add(`${trimmed},"failed_matches":[],"warnings":[]}`);
      } else {
        candidates.add(`${trimmed}],"failed_matches":[],"warnings":[]}`);
      }
    } else if (
      trimmed.startsWith('{"states":[') &&
      trimmed.includes('],"failed_matches"') &&
      !trimmed.includes('],"warnings"')
    ) {
      candidates.add(`${trimmed},"warnings":[]}`);
    }

    const completeStates = extractCompleteTopLevelObjects(text, "states");
    if (completeStates.length > 0) {
      candidates.add(
        `{"states":[${completeStates.join(
          ","
        )}],"failed_matches":[],"warnings":[]}`
      );
    }
  }

  return Array.from(candidates);
};

const parseStructuredJsonText = (
  text: string,
  schemaName: string
): unknown => {
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

    for (const repaired of buildSchemaRepairCandidates(text, schemaName)) {
      try {
        return JSON.parse(repaired) as unknown;
      } catch {
        // keep trying other repair candidates
      }
    }

    throw new Error(
      `OpenAI returned non-JSON structured text: ${previewText(text)}`
    );
  }
};

export class OpenAiResponsesTransport implements StructuredResponseTransport {
  constructor(private readonly env: AppEnv) {}

  async createStructuredResponse(
    request: StructuredResponseRequest
  ): Promise<unknown> {
    if (!this.env.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is required when USE_MOCK_DATA=false.");
    }

    const bodyPayload: Record<string, unknown> = {
      model: this.env.openAiModel,
      store: false,
      instructions: request.instructions,
      input: request.input,
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
    };

    if (!this.env.disableAiOutputTokenLimits) {
      bodyPayload.max_output_tokens = request.maxOutputTokens ?? 4000;
    }

    const body = JSON.stringify(bodyPayload);

    let raw: string | undefined;
    let parsedPayload: unknown;
    let outputText: string | undefined;

    try {
      raw = await new Promise<string>((resolve, reject) => {
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

      parsedPayload = JSON.parse(raw) as unknown;
      const metadata = extractWebSearchMetadata(parsedPayload);
      outputText = extractOutputText(parsedPayload);
      if (outputText.trim().length === 0) {
        throw new Error(
          "OpenAI returned an empty structured response after tool execution."
        );
      }
      const structured = parseStructuredJsonText(
        outputText,
        request.schema.name
      );

      await writeAiResponseLog(this.env, {
        provider: "openai",
        model: this.env.openAiModel,
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
        api_payload: parsedPayload,
        structured_output: structured,
        metadata
      });

      if (structured && typeof structured === "object") {
        return {
          ...structured,
          _openai_metadata: metadata
        } as Record<string, unknown>;
      }

      return structured;
    } catch (error) {
      await writeAiResponseLog(this.env, {
        provider: "openai",
        model: this.env.openAiModel,
        schema_name: request.schema.name,
        phase: error instanceof OpenAiApiError ? "api_error" : "parse_error",
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
        api_payload: parsedPayload,
        error: {
          message: error instanceof Error ? error.message : "Unknown OpenAI error.",
          status: error instanceof OpenAiApiError ? error.status : undefined,
          payload:
            error instanceof OpenAiApiError
              ? error.payload
              : {
                  output_text_preview: outputText
                    ? previewText(outputText, 1200)
                    : undefined
                }
        },
        metadata: outputText
          ? {
              output_text_preview: previewText(outputText, 1200)
            }
          : undefined
      });
      throw error;
    }
  }
}
