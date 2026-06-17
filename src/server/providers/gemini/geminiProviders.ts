import type { ProviderDebugInfo } from "../../../shared/types/api";
import type {
  StructuredResponseRequest,
  StructuredResponseTransport
} from "../../openai/transport";
import {
  StructuredSearchLiveEventDiscoveryProvider,
  StructuredSearchLiveEventLookupProvider,
  StructuredSearchLiveEventStateProvider,
  StructuredSearchUpcomingEventProvider,
  type StructuredSearchProviderFlavor
} from "../structured-search/providers";

const geminiFlavor: StructuredSearchProviderFlavor = {
  buildSearchRequest: (): Pick<
    StructuredResponseRequest,
    "tools" | "toolChoice" | "include"
  > => ({
    tools: [{ type: "web_search" }]
  }),
  getProviderDebug: (payload: Record<string, unknown>): ProviderDebugInfo => {
    const metadata =
      "_gemini_metadata" in payload &&
      payload._gemini_metadata &&
      typeof payload._gemini_metadata === "object"
        ? (payload._gemini_metadata as Record<string, unknown>)
        : null;
    const webSearch =
      metadata &&
      "web_search" in metadata &&
      metadata.web_search &&
      typeof metadata.web_search === "object"
        ? (metadata.web_search as Record<string, unknown>)
        : null;

    return {
      gemini_google_search: {
        required: true,
        tool_invoked: Boolean(webSearch?.tool_invoked),
        query_count:
          typeof webSearch?.query_count === "number"
            ? webSearch.query_count
            : 0,
        source_count:
          typeof webSearch?.source_count === "number"
            ? webSearch.source_count
            : 0,
        sources: Array.isArray(webSearch?.sources)
          ? webSearch.sources.map((source) => String(source))
          : [],
        finish_reason:
          typeof webSearch?.finish_reason === "string"
            ? webSearch.finish_reason
            : undefined,
        response_preview:
          typeof webSearch?.response_preview === "string"
            ? webSearch.response_preview
            : undefined
      }
    };
  },
  wasSearchInvoked: (providerDebug: ProviderDebugInfo): boolean =>
    Boolean(providerDebug.gemini_google_search?.tool_invoked),
  missingSearchWarning:
    "Gemini response did not include Google Search grounding metadata, so the results are being shown without verified grounding.",
  missingSearchFailureCode: "GOOGLE_SEARCH_REQUIRED",
  responseObjectLabel: "Gemini",
  allowUngroundedResults: true
};

export class GeminiLiveEventDiscoveryProvider extends StructuredSearchLiveEventDiscoveryProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, geminiFlavor);
  }
}

export class GeminiLiveEventStateProvider extends StructuredSearchLiveEventStateProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, geminiFlavor);
  }
}

export class GeminiLiveEventLookupProvider extends StructuredSearchLiveEventLookupProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, geminiFlavor);
  }
}

export class GeminiUpcomingEventProvider extends StructuredSearchUpcomingEventProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, geminiFlavor);
  }
}
