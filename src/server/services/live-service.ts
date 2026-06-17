import type { AppEnv } from "../config/env";
import type { AiAccessController } from "./ai-access";
import type {
  LiveEventDiscoveryProvider,
  LiveEventLookupProvider,
  LiveEventStateProvider
} from "../providers/types";
import type { UpcomingEventProvider } from "../providers/types";
import type {
  DiscoverRequest,
  MatchContext,
  MatchIdentity,
  ProviderMode,
  ProviderOption,
  PublicConfig,
  UpcomingEvent,
  UpcomingQuery
} from "../../shared/schemas/live";

export class AiDisabledError extends Error {
  constructor() {
    super("AI-backed sports intelligence is temporarily unavailable.");
  }
}

export class LiveService {
  constructor(
    private readonly env: AppEnv,
    private readonly aiAccessController: AiAccessController,
    private readonly getRuntimeProviderConfig: () => {
      activeMode: ProviderMode;
      availableOptions: ProviderOption[];
    },
    private readonly discoveryProvider: LiveEventDiscoveryProvider,
    private readonly stateProvider: LiveEventStateProvider,
    private readonly lookupProvider: LiveEventLookupProvider,
    private readonly upcomingProvider: UpcomingEventProvider
  ) {}

  async getConfig(): Promise<PublicConfig> {
    const runtimeProviderConfig = this.getRuntimeProviderConfig();
    return {
      api_version: "v1",
      ai_service_available: await this.aiAccessController.isAiEnabled(),
      discovery_refresh_after_seconds: this.env.liveDiscoveryRefreshSeconds,
      state_refresh_after_seconds: this.env.liveStateRefreshSeconds,
      max_live_events: this.env.maxLiveEvents,
      public_api_access: this.env.publicApiAccess,
      use_mock_data: runtimeProviderConfig.activeMode === "mock",
      active_model: runtimeProviderConfig.activeMode,
      available_models: runtimeProviderConfig.availableOptions
    };
  }

  async discover(input: DiscoverRequest) {
    await this.assertAiEnabled();
    return this.discoveryProvider.discover(input);
  }

  async refreshStates(input: {
    region: string;
    sport: string;
    matches: MatchIdentity[];
  }) {
    await this.assertAiEnabled();
    return this.stateProvider.refreshStates(input);
  }

  async getLiveEvent(matchId: string) {
    await this.assertAiEnabled();
    return this.lookupProvider.getLiveEvent(matchId);
  }

  async getContext(matchId: string): Promise<MatchContext | null> {
    await this.assertAiEnabled();
    return this.lookupProvider.getContext(matchId);
  }

  async getState(matchId: string) {
    await this.assertAiEnabled();
    return this.lookupProvider.getState(matchId);
  }

  async getUpcoming(input: UpcomingQuery) {
    await this.assertAiEnabled();
    if (input.days > this.env.maxUpcomingDays) {
      throw new Error(
        `Requested days exceeds MAX_UPCOMING_DAYS (${this.env.maxUpcomingDays}).`
      );
    }

    const result = await this.upcomingProvider.getUpcoming(input);
    return {
      ...result,
      events: result.events.slice(0, this.env.maxUpcomingEvents)
    };
  }

  async getUpcomingByMatchId(matchId: string): Promise<UpcomingEvent | null> {
    await this.assertAiEnabled();
    return this.upcomingProvider.getUpcomingByMatchId(matchId);
  }

  private async assertAiEnabled(): Promise<void> {
    if (!(await this.aiAccessController.isAiEnabled())) {
      throw new AiDisabledError();
    }
  }
}
