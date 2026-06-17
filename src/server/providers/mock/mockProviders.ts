import type {
  DiscoverRequest,
  MatchIdentity
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
  async discover(input: DiscoverRequest) {
    const knownFingerprints = new Map(
      input.known_matches.map(
        (match: DiscoverRequest["known_matches"][number]) => [
          match.match_id,
          match.context_fingerprint
        ]
      )
    );
    return {
      events: discoverMockEvents(
        knownFingerprints,
        input.include_context,
        input.sport,
        input.region
      ),
      warnings: []
    };
  }
}

export class MockLiveEventStateProvider implements LiveEventStateProvider {
  async refreshStates(input: {
    region: string;
    sport: string;
    matches: MatchIdentity[];
  }) {
    return {
      states: refreshMockStates(input.matches),
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
  async getUpcoming(input: { region: string; sport: string; days: number }) {
    return {
      events: listMockUpcomingEvents(input.region, input.sport, input.days),
      warnings: []
    };
  }

  async getUpcomingByMatchId(matchId: string) {
    return findMockUpcomingEvent(matchId);
  }
}
