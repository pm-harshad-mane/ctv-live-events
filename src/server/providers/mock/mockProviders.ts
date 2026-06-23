import type {
  DiscoverRequestInput,
  MatchIdentity,
  StateRefreshRequestInput,
  UpcomingQueryInput
} from "../../../shared/schemas/live";
import type {
  LiveEventDiscoveryProvider,
  LiveEventLookupProvider,
  LiveEventStateProvider,
  UpcomingEventProvider
} from "../types";
import {
  discoverMockEvents,
  findMockContext,
  findMockLiveEvent,
  findMockState,
  findMockUpcomingEvent,
  listMockUpcomingEvents,
  refreshMockStates
} from "./mockData";

export class MockLiveEventDiscoveryProvider implements LiveEventDiscoveryProvider {
  async discover(input: DiscoverRequestInput) {
    const knownMatches = input.known_matches ?? [];
    const knownFingerprints = new Map(
      knownMatches.map(
        (match: NonNullable<DiscoverRequestInput["known_matches"]>[number]) => [
          match.match_id,
          match.context_fingerprint
        ]
      )
    );
    return {
      events: discoverMockEvents(
        knownFingerprints,
        input.include_context ?? true,
        input.sport ?? "all",
        input.region ?? "north-america"
      ),
      warnings: []
    };
  }
}

export class MockLiveEventStateProvider implements LiveEventStateProvider {
  async refreshStates(input: StateRefreshRequestInput) {
    return {
      states: refreshMockStates(input.matches ?? []),
      failed_matches: [],
      warnings: []
    };
  }
}

export class MockLiveEventLookupProvider implements LiveEventLookupProvider {
  async getContext(matchId: string) {
    return findMockContext(matchId);
  }

  async getState(matchId: string) {
    return findMockState(matchId);
  }

  async getLiveEvent(matchId: string) {
    return findMockLiveEvent(matchId);
  }
}

export class MockUpcomingEventProvider implements UpcomingEventProvider {
  async getUpcoming(input: UpcomingQueryInput) {
    return {
      events: listMockUpcomingEvents(
        input.region ?? "north-america",
        input.sport ?? "all",
        input.days ?? 7
      ),
      warnings: []
    };
  }

  async getUpcomingByMatchId(matchId: string) {
    return findMockUpcomingEvent(matchId);
  }
}
