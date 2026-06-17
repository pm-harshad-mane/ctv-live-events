import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv } from "../../src/server/config/env";
import { requireApiAccess } from "../../src/server/http/auth";
import {
  MockLiveEventDiscoveryProvider,
  MockLiveEventLookupProvider,
  MockLiveEventStateProvider,
  MockUpcomingEventProvider
} from "../../src/server/providers/mock/mockProviders";
import {
  LiveService,
  AiDisabledError
} from "../../src/server/services/live-service";
import { EnvironmentAiAccessController } from "../../src/server/services/ai-access";
import { getOpenApiDocument } from "../../src/server/openapi/document";

describe("API service and middleware", () => {
  beforeEach(() => {
    process.env.PUBLIC_API_ACCESS = "true";
    process.env.AI_ENABLED = "true";
    process.env.ALLOWED_API_ORIGINS = "http://localhost:5173";
    process.env.EXTERNAL_API_KEYS = "dev-key-1";
  });

  const createService = () => {
    const env = getEnv();
    return new LiveService(
      env,
      new EnvironmentAiAccessController(env.aiEnabled),
      new MockLiveEventDiscoveryProvider(),
      new MockLiveEventStateProvider(),
      new MockLiveEventLookupProvider(),
      new MockUpcomingEventProvider()
    );
  };

  it("returns public config with AI availability", async () => {
    const service = createService();
    const config = await service.getConfig();

    expect(config.api_version).toBe("v1");
    expect(config.ai_service_available).toBe(true);
  });

  it("defaults public api access on for local mock development", () => {
    delete process.env.PUBLIC_API_ACCESS;
    delete process.env.NODE_ENV;
    delete process.env.USE_MOCK_DATA;

    const env = getEnv();
    expect(env.useMockData).toBe(true);
    expect(env.publicApiAccess).toBe(true);
  });

  it("returns live discovery data when AI is enabled", async () => {
    const service = createService();
    const result = await service.discover({
      region: "north-america",
      sport: "all",
      include_context: true,
      known_matches: []
    });

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].context).not.toBeNull();
  });

  it("filters live discovery by sport", async () => {
    const service = createService();
    const result = await service.discover({
      region: "north-america",
      sport: "soccer",
      include_context: true,
      known_matches: []
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].context?.match.sport).toBe("soccer");
  });

  it("filters live discovery by region", async () => {
    const service = createService();
    const result = await service.discover({
      region: "europe",
      sport: "all",
      include_context: true,
      known_matches: []
    });

    expect(result.events).toHaveLength(2);
    expect(
      result.events.map((event) => event.context?.match.sport).sort()
    ).toEqual(["soccer", "tennis"]);
  });

  it("supports all enabled live sports in mock discovery", async () => {
    const service = createService();
    const sports = [
      "american-football",
      "baseball",
      "basketball",
      "cricket",
      "hockey",
      "mma",
      "soccer",
      "tennis"
    ];

    for (const sport of sports) {
      const result = await service.discover({
        region: "global",
        sport,
        include_context: true,
        known_matches: []
      });

      expect(result.events.length).toBeGreaterThan(0);
      expect(
        result.events.every((event) => event.context?.match.sport === sport)
      ).toBe(true);
    }
  });

  it("returns sport-specific soccer state details", async () => {
    const service = createService();
    const state = await service.getState("soccer:mls:2026-06-16:lafc:sea");

    expect(state?.period.display).toBe("2nd Half");
    expect(state?.clock.display.includes("'")).toBe(true);
  });

  it("throws when AI is disabled", async () => {
    process.env.AI_ENABLED = "false";
    const service = createService();

    await expect(
      service.discover({
        region: "north-america",
        sport: "all",
        include_context: true,
        known_matches: []
      })
    ).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("does not call providers when AI is disabled", async () => {
    const discover = vi.fn();
    const refreshStates = vi.fn();
    const getLiveEvent = vi.fn();
    const getContext = vi.fn();
    const getState = vi.fn();
    const getUpcoming = vi.fn();
    const getUpcomingByMatchId = vi.fn();
    const env = getEnv();
    const service = new LiveService(
      env,
      new EnvironmentAiAccessController(false),
      { discover },
      { refreshStates },
      { getLiveEvent, getContext, getState },
      { getUpcoming, getUpcomingByMatchId }
    );

    await expect(
      service.discover({
        region: "north-america",
        sport: "all",
        include_context: true,
        known_matches: []
      })
    ).rejects.toBeInstanceOf(AiDisabledError);

    expect(discover).not.toHaveBeenCalled();
    expect(refreshStates).not.toHaveBeenCalled();
    expect(getLiveEvent).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
    expect(getState).not.toHaveBeenCalled();
    expect(getUpcoming).not.toHaveBeenCalled();
    expect(getUpcomingByMatchId).not.toHaveBeenCalled();
  });

  it("returns context and state for a specific live match", async () => {
    const service = createService();
    const matchId = "basketball:nba:2026-06-16:bos:gsw";

    const context = await service.getContext(matchId);
    const state = await service.getState(matchId);

    expect(context?.match.match_id).toBe(matchId);
    expect(context?.match.venue.city).toBe("San Francisco");
    expect(context?.match.venue.country).toBe("United States");
    expect(state?.match_id).toBe(matchId);
  });

  it("returns upcoming events within the requested window", async () => {
    const service = createService();
    const result = await service.getUpcoming({
      region: "north-america",
      sport: "all",
      days: 7
    });

    expect(result.events.length).toBeGreaterThan(0);
    expect(
      result.events[0].upcoming_intelligence.watch_reasons.length
    ).toBeGreaterThan(0);
  });

  it("filters upcoming events by region", async () => {
    const service = createService();
    const result = await service.getUpcoming({
      region: "asia-pacific",
      sport: "all",
      days: 7
    });

    expect(result.events).toHaveLength(2);
    expect(
      result.events.map((event) => event.context.match.sport).sort()
    ).toEqual(["basketball", "cricket"]);
  });

  it("supports all enabled sports in upcoming lookups", async () => {
    const service = createService();
    const sports = [
      "american-football",
      "baseball",
      "basketball",
      "cricket",
      "hockey",
      "mma",
      "soccer",
      "tennis"
    ];

    for (const sport of sports) {
      const result = await service.getUpcoming({
        region: "global",
        sport,
        days: 7
      });

      expect(result.events.length).toBeGreaterThan(0);
      expect(
        result.events.every((event) => event.context.match.sport === sport)
      ).toBe(true);
    }
  });

  it("returns a specific upcoming match by id", async () => {
    const service = createService();
    const event = await service.getUpcomingByMatchId(
      "basketball:nba:2026-06-18:nyk:mil"
    );

    expect(event?.context.match.match_name).toContain("Knicks");
  });

  it("rejects protected access without a key when public access is disabled", () => {
    process.env.PUBLIC_API_ACCESS = "false";
    const middleware = requireApiAccess(getEnv());
    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    };

    const next = vi.fn();
    middleware(
      {
        headers: {},
        app: { get: () => ({ warn: vi.fn() }) }
      } as never,
      response as never,
      next
    );

    expect(response.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows configured browser traffic through referer origin", () => {
    process.env.PUBLIC_API_ACCESS = "false";
    const middleware = requireApiAccess(getEnv());
    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    };

    const next = vi.fn();
    middleware(
      {
        headers: {
          referer: "http://localhost:5173/"
        },
        app: { get: () => ({ warn: vi.fn() }) }
      } as never,
      response as never,
      next
    );

    expect(next).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
  });

  it("serves a valid openapi document source", () => {
    const document = getOpenApiDocument() as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/api/v1/events/upcoming"]).toBeDefined();
    expect(
      document.paths["/api/v1/events/live/{matchId}/context"]
    ).toBeDefined();
  });
});
