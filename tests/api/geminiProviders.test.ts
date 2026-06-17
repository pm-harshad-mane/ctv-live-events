import { describe, expect, it, vi } from "vitest";
import {
  GeminiLiveEventDiscoveryProvider,
  GeminiUpcomingEventProvider
} from "../../src/server/providers/gemini/geminiProviders";
import type { StructuredResponseTransport } from "../../src/server/openai/transport";

const withGroundingMetadata = <T extends object>(
  payload: T,
  overrides?: Partial<{
    tool_invoked: boolean;
    query_count: number;
    source_count: number;
    sources: string[];
  }>
) => ({
  ...payload,
  _gemini_metadata: {
    web_search: {
      tool_invoked: overrides?.tool_invoked ?? true,
      query_count: overrides?.query_count ?? 1,
      source_count: overrides?.source_count ?? 2,
      sources: overrides?.sources ?? ["Google Search", "mlssoccer.com"]
    }
  }
});

const createTransport = (
  responseFactory: (request: {
    instructions: string;
    input: string;
    schema: { name: string; schema: Record<string, unknown> };
    maxOutputTokens?: number;
    tools?: Array<Record<string, unknown>>;
    toolChoice?: "auto" | "none";
    include?: string[];
  }) => unknown
): StructuredResponseTransport & {
  createStructuredResponse: ReturnType<typeof vi.fn>;
} => ({
  createStructuredResponse: vi.fn(async (request) => responseFactory(request))
});

describe("Gemini providers", () => {
  it("uses Google Search grounding for discovery", async () => {
    const transport = createTransport(() =>
      withGroundingMetadata({
        events: [],
        warnings: []
      })
    );
    const provider = new GeminiLiveEventDiscoveryProvider(transport);

    const result = await provider.discover({
      region: "north-america",
      sport: "soccer",
      include_context: true,
      known_matches: []
    });

    expect(transport.createStructuredResponse).toHaveBeenCalledTimes(1);
    const request = transport.createStructuredResponse.mock.calls[0][0];
    expect(request.schema.name).toBe("live_discovery_response");
    expect(request.instructions).toContain("Use web search");
    expect(request.tools).toEqual([{ type: "web_search" }]);
    expect(result.provider_debug?.gemini_google_search?.tool_invoked).toBe(
      true
    );
  });

  it("fails closed when grounding metadata is missing", async () => {
    const transport = createTransport(() => ({
      events: [],
      warnings: []
    }));
    const provider = new GeminiUpcomingEventProvider(transport);

    const result = await provider.getUpcoming({
      region: "global",
      sport: "all",
      days: 7
    });

    expect(result.events).toEqual([]);
    expect(result.warnings[0]).toContain(
      "no Google Search grounding metadata was present"
    );
    expect(result.provider_debug?.gemini_google_search?.tool_invoked).toBe(
      false
    );
  });
});
