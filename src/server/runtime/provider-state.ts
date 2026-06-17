import type { AppEnv } from "../config/env";
import type { ProviderMode, ProviderOption } from "../../shared/schemas/live";

export class RuntimeProviderState {
  private activeMode: ProviderMode;

  constructor(private readonly env: AppEnv) {
    this.activeMode = env.defaultProviderMode;
  }

  getAvailableOptions(): ProviderOption[] {
    return this.env.enabledProviderModes.map((mode) => ({
      id: mode,
      label: this.getLabel(mode)
    }));
  }

  getActiveMode(): ProviderMode {
    return this.activeMode;
  }

  setActiveMode(mode: ProviderMode): void {
    if (!this.env.enabledProviderModes.includes(mode)) {
      throw new Error(
        `Provider mode "${mode}" is not enabled in this environment.`
      );
    }

    this.activeMode = mode;
  }

  private getLabel(mode: ProviderMode): string {
    switch (mode) {
      case "mock":
        return this.env.mockDisplayLabel;
      case "openai":
        return this.env.openAiDisplayLabel;
      case "gemini":
        return this.env.geminiDisplayLabel;
    }
  }
}
