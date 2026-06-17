export interface AiAccessController {
  isAiEnabled(): Promise<boolean>;
}

export class EnvironmentAiAccessController implements AiAccessController {
  constructor(private readonly aiEnabled: boolean) {}

  async isAiEnabled(): Promise<boolean> {
    return this.aiEnabled;
  }
}
