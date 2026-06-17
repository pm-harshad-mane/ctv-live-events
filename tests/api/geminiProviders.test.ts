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

  it("returns Gemini results with warnings when grounding metadata is missing", async () => {
    const transport = createTransport(() => ({
      _gemini_metadata: {
        web_search: {
          tool_invoked: false,
          query_count: 0,
          source_count: 0,
          sources: [],
          finish_reason: "STOP",
          response_preview: '{"events":[{"match_id":"soccer:demo:upcoming"}]}'
        }
      },
      events: [
        {
          match_id: "soccer:demo:upcoming",
          context: {
            match: {
              match_id: "soccer:demo:upcoming",
              match_name: "Portugal vs DR Congo",
              sport: "soccer",
              tournament_name: "FIFA World Cup",
              tournament_stage: "Group Stage",
              scheduled_start_time: "2026-06-17T19:00:00Z",
              venue: {
                stadium: "MetLife Stadium",
                city: "East Rutherford",
                state: "New Jersey",
                country: "United States"
              }
            },
            participants: [
              {
                participant_id: "por",
                name: "Portugal",
                short_name: "POR",
                role: "home",
                ranking: "7",
                recent_form: ["W", "D", "W"]
              },
              {
                participant_id: "cod",
                name: "DR Congo",
                short_name: "COD",
                role: "away",
                ranking: "61",
                recent_form: ["W", "L", "W"]
              }
            ],
            pre_match_intelligence: {
              headline: "Portugal should control most phases",
              summary: "DR Congo still has transition threat.",
              expected_competitiveness: 71,
              key_matchup: "Portugal midfield control vs Congo counters"
            },
            context_version: 1,
            context_fingerprint: "ctx_por_cod",
            context_generated_at: "2026-06-17T17:00:00Z"
          },
          upcoming_intelligence: {
            headline: "Portugal favored in the group opener",
            summary: "This should still produce dangerous transition moments.",
            projected_competitiveness: 74,
            watch_reasons: ["Portugal chance creation", "Congo counterattacks"],
            win_probabilities: [
              {
                participant_id: "por",
                probability: 0.62
              },
              {
                participant_id: "cod",
                probability: 0.38
              }
            ]
          },
          freshness: {
            generated_at: "2026-06-17T17:00:00Z",
            age_seconds: 30
          }
        }
      ],
      warnings: []
    }));
    const provider = new GeminiUpcomingEventProvider(transport);

    const result = await provider.getUpcoming({
      region: "global",
      sport: "all",
      days: 7
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.match_id).toBe("soccer:demo:upcoming");
    expect(result.warnings[0]).toContain(
      "did not include Google Search grounding metadata"
    );
    expect(result.warnings[1]).toContain("Gemini finish reason: STOP");
    expect(result.warnings[2]).toContain(
      'Gemini response preview: {"events":[{"match_id":"soccer:demo:upcoming"}]}'
    );
    expect(result.provider_debug?.gemini_google_search?.tool_invoked).toBe(
      false
    );
    expect(result.provider_debug?.gemini_google_search?.response_preview).toBe(
      '{"events":[{"match_id":"soccer:demo:upcoming"}]}'
    );
  });
});
