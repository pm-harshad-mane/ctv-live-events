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
  regionToApproximateUserLocation,
  type StructuredSearchProviderFlavor
} from "../structured-search/providers";

const openAiFlavor: StructuredSearchProviderFlavor = {
  buildSearchRequest: (
    region: string
  ): Pick<StructuredResponseRequest, "tools" | "toolChoice" | "include"> => ({
    tools: [
      {
        type: "web_search",
        user_location: regionToApproximateUserLocation(region),
        external_web_access: true
      }
    ],
    toolChoice: "auto",
    include: ["web_search_call.action.sources"]
  }),
  getProviderDebug: (payload: Record<string, unknown>): ProviderDebugInfo => {
    const metadata =
      "_openai_metadata" in payload &&
      payload._openai_metadata &&
      typeof payload._openai_metadata === "object"
        ? (payload._openai_metadata as Record<string, unknown>)
        : null;
    const webSearch =
      metadata &&
      "web_search" in metadata &&
      metadata.web_search &&
      typeof metadata.web_search === "object"
        ? (metadata.web_search as Record<string, unknown>)
        : null;

    return {
      openai_web_search: {
        required: true,
        tool_invoked: Boolean(webSearch?.tool_invoked),
        call_count:
          typeof webSearch?.call_count === "number" ? webSearch.call_count : 0,
        source_count:
          typeof webSearch?.source_count === "number"
            ? webSearch.source_count
            : 0,
        sources: Array.isArray(webSearch?.sources)
          ? webSearch.sources.map((source) => String(source))
          : []
      }
    };
  },
  wasSearchInvoked: (providerDebug: ProviderDebugInfo): boolean =>
    Boolean(providerDebug.openai_web_search?.tool_invoked),
  missingSearchWarning:
    "OpenAI response was rejected because no web_search_call was present, even though web search is required for this endpoint.",
  missingSearchFailureCode: "WEB_SEARCH_REQUIRED",
  responseObjectLabel: "OpenAI"
};

export class OpenAiLiveEventDiscoveryProvider extends StructuredSearchLiveEventDiscoveryProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, openAiFlavor);
  }
}

export class OpenAiLiveEventStateProvider extends StructuredSearchLiveEventStateProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, openAiFlavor);
  }
}

export class OpenAiLiveEventLookupProvider extends StructuredSearchLiveEventLookupProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, openAiFlavor);
  }
}

export class OpenAiUpcomingEventProvider extends StructuredSearchUpcomingEventProvider {
  constructor(transport: StructuredResponseTransport) {
    super(transport, openAiFlavor);
  }
}
