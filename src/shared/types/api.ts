import type {
  LiveEvent,
  LiveState,
  MatchIdentity,
  MatchContext,
  PublicConfig,
  UpcomingEvent
} from "../schemas/live";

export type ProviderDebugInfo = {
  result_filtering?: {
    raw_event_count: number;
    accepted_event_count: number;
    rejected_events: Array<{
      match_id: string;
      match_name?: string;
      reason: string;
    }>;
  };
  openai_web_search?: {
    required: boolean;
    tool_invoked: boolean;
    call_count: number;
    source_count: number;
    sources: string[];
  };
  gemini_google_search?: {
    required: boolean;
    tool_invoked: boolean;
    query_count: number;
    source_count: number;
    sources: string[];
    finish_reason?: string;
    response_preview?: string;
  };
};

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "AI_USAGE_DISABLED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiEnvelope<T> = {
  api_version: "v1";
  request_id: string;
  generated_at: string;
  data: T;
  warnings: string[];
};

export type ErrorEnvelope = {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
  };
  request_id: string;
  timestamp: string;
};

export type DiscoverResponseData = {
  request: {
    region: string;
    sport: string;
    include_context: boolean;
  };
  meta: {
    count: number;
    region: string;
    sport: string;
    state_refresh_after_seconds: number;
    discovery_refresh_after_seconds: number;
    ai_service_available: boolean;
  };
  events: LiveEvent[];
  provider_debug?: ProviderDebugInfo;
};

export type StateRefreshResponseData = {
  meta: {
    count: number;
    region: string;
    sport: string;
    state_refresh_after_seconds: number;
    discovery_refresh_after_seconds: number;
    ai_service_available: boolean;
  };
  states: LiveState[];
  failed_matches: Array<{
    match_id: string;
    code: string;
    message: string;
  }>;
  provider_debug?: ProviderDebugInfo;
};

export type ConfigResponseData = PublicConfig;

export type HealthResponseData = {
  status: "ok";
  service: "live-sports-intelligence";
  timestamp: string;
  api_version: "v1";
};

export type LiveCollectionResponseData = {
  meta: {
    count: number;
    region: string;
    sport: string;
    state_refresh_after_seconds: number;
    discovery_refresh_after_seconds: number;
    ai_service_available: boolean;
  };
  events: LiveEvent[];
  provider_debug?: ProviderDebugInfo;
};

export type LiveMatchResponseData = {
  event: LiveEvent;
};

export type LiveContextResponseData = {
  match_id: string;
  context: MatchContext;
  freshness: {
    context_generated_at: string;
  };
};

export type LiveStateResponseData = {
  match_id: string;
  live_state: LiveState;
  freshness: {
    state_generated_at: string;
  };
};

export type UpcomingCollectionResponseData = {
  meta: {
    count: number;
    region: string;
    sport: string;
    days: number;
    ai_service_available: boolean;
  };
  events: UpcomingEvent[];
  provider_debug?: ProviderDebugInfo;
};

export type UpcomingMatchResponseData = {
  event: UpcomingEvent;
};

export type KnownMatchIdentity = MatchIdentity;
