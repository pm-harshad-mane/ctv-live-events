import type {
  DiscoverRequest,
  LiveEvent,
  LiveState,
  MatchContext,
  MatchIdentity,
  UpcomingEvent
} from "../../shared/schemas/live";
import type { ProviderDebugInfo } from "../../shared/types/api";

export interface LiveEventDiscoveryProvider {
  discover(input: DiscoverRequest): Promise<{
    events: LiveEvent[];
    warnings: string[];
    provider_debug?: ProviderDebugInfo;
  }>;
}

export interface LiveEventStateProvider {
  refreshStates(input: {
    region: string;
    sport: string;
    matches: MatchIdentity[];
  }): Promise<{
    states: LiveState[];
    failed_matches: Array<{
      match_id: string;
      code: string;
      message: string;
    }>;
    warnings: string[];
    provider_debug?: ProviderDebugInfo;
  }>;
}

export interface LiveEventLookupProvider {
  getContext(matchId: string): Promise<MatchContext | null>;
  getState(matchId: string): Promise<LiveState | null>;
  getLiveEvent(matchId: string): Promise<LiveEvent | null>;
}

export interface UpcomingEventProvider {
  getUpcoming(input: { region: string; sport: string; days: number }): Promise<{
    events: UpcomingEvent[];
    warnings: string[];
    provider_debug?: ProviderDebugInfo;
  }>;
  getUpcomingByMatchId(matchId: string): Promise<UpcomingEvent | null>;
}
