import express from "express";
import { getEnv } from "./config/env";
import { requireApiAccess } from "./http/auth";
import { withCors } from "./http/cors";
import { createRequestId, sendEnvelope, sendError } from "./lib/http";
import { getOpenApiDocument } from "./openapi/document";
import {
  MockLiveEventDiscoveryProvider,
  MockLiveEventLookupProvider,
  MockLiveEventStateProvider,
  MockUpcomingEventProvider
} from "./providers/mock/mockProviders";
import {
  GeminiLiveEventDiscoveryProvider,
  GeminiLiveEventLookupProvider,
  GeminiLiveEventStateProvider,
  GeminiUpcomingEventProvider
} from "./providers/gemini/geminiProviders";
import {
  OpenAiLiveEventDiscoveryProvider,
  OpenAiLiveEventLookupProvider,
  OpenAiLiveEventStateProvider,
  OpenAiUpcomingEventProvider
} from "./providers/openai/openAiProviders";
import { OpenAiResponsesTransport } from "./openai/transport";
import { GeminiStructuredTransport } from "./gemini/transport";
import { EnvironmentAiAccessController } from "./services/ai-access";
import { AiDisabledError, LiveService } from "./services/live-service";
import { RuntimeProviderState } from "./runtime/provider-state";
import {
  configSchema,
  discoverRequestSchema,
  providerModeSchema,
  stateRefreshRequestSchema,
  upcomingQuerySchema
} from "../shared/schemas/live";

export const createApp = () => {
  const env = getEnv();
  const app = express();

  app.set("logger", console);
  app.use(express.json({ limit: "100kb" }));
  app.use(withCors(env));

  const openAiTransport = new OpenAiResponsesTransport(env);
  const geminiTransport = new GeminiStructuredTransport(env);
  const runtimeProviderState = new RuntimeProviderState(env);
  const providerBundles = {
    mock: {
      discoveryProvider: new MockLiveEventDiscoveryProvider(),
      stateProvider: new MockLiveEventStateProvider(),
      lookupProvider: new MockLiveEventLookupProvider(),
      upcomingProvider: new MockUpcomingEventProvider()
    },
    openai: {
      discoveryProvider: new OpenAiLiveEventDiscoveryProvider(openAiTransport),
      stateProvider: new OpenAiLiveEventStateProvider(openAiTransport),
      lookupProvider: new OpenAiLiveEventLookupProvider(openAiTransport),
      upcomingProvider: new OpenAiUpcomingEventProvider(openAiTransport)
    },
    gemini: {
      discoveryProvider: new GeminiLiveEventDiscoveryProvider(geminiTransport),
      stateProvider: new GeminiLiveEventStateProvider(geminiTransport),
      lookupProvider: new GeminiLiveEventLookupProvider(geminiTransport),
      upcomingProvider: new GeminiUpcomingEventProvider(geminiTransport)
    }
  } as const;

  const getActiveProviders = () =>
    providerBundles[runtimeProviderState.getActiveMode()];

  const liveService = new LiveService(
    env,
    new EnvironmentAiAccessController(env.aiEnabled),
    () => ({
      activeMode: runtimeProviderState.getActiveMode(),
      availableOptions: runtimeProviderState.getAvailableOptions()
    }),
    {
      discover: (input) =>
        getActiveProviders().discoveryProvider.discover(input)
    },
    {
      refreshStates: (input) =>
        getActiveProviders().stateProvider.refreshStates(input)
    },
    {
      getContext: (matchId) =>
        getActiveProviders().lookupProvider.getContext(matchId),
      getState: (matchId) =>
        getActiveProviders().lookupProvider.getState(matchId),
      getLiveEvent: (matchId) =>
        getActiveProviders().lookupProvider.getLiveEvent(matchId)
    },
    {
      getUpcoming: (input) =>
        getActiveProviders().upcomingProvider.getUpcoming(input),
      getUpcomingByMatchId: (matchId) =>
        getActiveProviders().upcomingProvider.getUpcomingByMatchId(matchId)
    }
  );

  const handleKnownError = (
    response: express.Response,
    requestId: string,
    error: unknown,
    badRequestStatus = 400
  ): void => {
    if (error instanceof AiDisabledError) {
      sendError(
        response,
        requestId,
        503,
        "AI_USAGE_DISABLED",
        error.message,
        false,
        {
          "Retry-After": String(env.aiDisabledRetryAfterSeconds)
        }
      );
      return;
    }

    if (error instanceof Error) {
      sendError(
        response,
        requestId,
        badRequestStatus,
        "BAD_REQUEST",
        error.message,
        false
      );
      return;
    }

    sendError(
      response,
      requestId,
      500,
      "INTERNAL_ERROR",
      "Unexpected error.",
      true
    );
  };

  app.get("/api/v1/health", (_request, response) => {
    sendEnvelope(response, createRequestId(), {
      status: "ok",
      service: "live-sports-intelligence",
      timestamp: new Date().toISOString(),
      api_version: "v1"
    });
  });

  app.get("/api/v1/config", async (_request, response) => {
    const requestId = createRequestId();
    const config = configSchema.parse(await liveService.getConfig());
    sendEnvelope(response, requestId, config);
  });

  app.get("/api/v1/openapi.json", (_request, response) => {
    response.json(getOpenApiDocument());
  });

  app.get("/api/docs", (_request, response) => {
    response.type("html").send(`
      <html>
        <head><title>CTV Live Events API Docs</title></head>
        <body>
          <h1>CTV Live Events API</h1>
          <p>Use <code>Authorization: Bearer &lt;api-key&gt;</code> for server-to-server access.</p>
          <p>For efficient live polling, call <code>POST /api/v1/events/live/discover</code> then <code>POST /api/v1/events/live/state</code>.</p>
          <p>Context-only lookups are available at <code>/api/v1/events/live/:matchId/context</code>.</p>
          <p>State-only lookups are available at <code>/api/v1/events/live/:matchId/state</code>.</p>
          <p>Upcoming events are available at <code>/api/v1/events/upcoming</code>.</p>
          <p>The machine-readable specification is available at <code>/api/v1/openapi.json</code>.</p>
        </body>
      </html>
    `);
  });

  app.use("/api/v1/events", requireApiAccess(env));
  app.use("/api/v1/runtime", requireApiAccess(env));

  app.post("/api/v1/runtime/model", async (request, response) => {
    const requestId = createRequestId();
    try {
      const nextMode = providerModeSchema.parse(request.body.model);
      runtimeProviderState.setActiveMode(nextMode);
      const config = configSchema.parse(await liveService.getConfig());
      sendEnvelope(response, requestId, config);
    } catch (error) {
      handleKnownError(response, requestId, error);
    }
  });

  app.get("/api/v1/events/live/discover", async (request, response) => {
    const requestId = createRequestId();
    try {
      const payload = discoverRequestSchema.parse({
        region: String(request.query.region ?? env.defaultRegion),
        sport: String(request.query.sport ?? "all"),
        include_context: request.query.include_context !== "false",
        known_matches: []
      });

      const result = await liveService.discover(payload);
      sendEnvelope(
        response,
        requestId,
        {
          request: {
            region: payload.region,
            sport: payload.sport,
            include_context: payload.include_context
          },
          meta: {
            count: result.events.length,
            region: payload.region,
            sport: payload.sport,
            state_refresh_after_seconds: env.liveStateRefreshSeconds,
            discovery_refresh_after_seconds: env.liveDiscoveryRefreshSeconds,
            ai_service_available: env.aiEnabled
          },
          events: result.events,
          provider_debug: result.provider_debug
        },
        result.warnings
      );
    } catch (error) {
      handleKnownError(response, requestId, error);
    }
  });

  app.post("/api/v1/events/live/discover", async (request, response) => {
    const requestId = createRequestId();
    try {
      const payload = discoverRequestSchema.parse({
        region: request.body.region ?? env.defaultRegion,
        sport: request.body.sport ?? "all",
        include_context: request.body.include_context ?? true,
        known_matches: request.body.known_matches ?? []
      });

      const result = await liveService.discover(payload);
      sendEnvelope(
        response,
        requestId,
        {
          request: {
            region: payload.region,
            sport: payload.sport,
            include_context: payload.include_context
          },
          meta: {
            count: result.events.length,
            region: payload.region,
            sport: payload.sport,
            state_refresh_after_seconds: env.liveStateRefreshSeconds,
            discovery_refresh_after_seconds: env.liveDiscoveryRefreshSeconds,
            ai_service_available: env.aiEnabled
          },
          events: result.events,
          provider_debug: result.provider_debug
        },
        result.warnings
      );
    } catch (error) {
      handleKnownError(response, requestId, error);
    }
  });

  app.post("/api/v1/events/live/state", async (request, response) => {
    const requestId = createRequestId();
    try {
      const payload = stateRefreshRequestSchema.parse({
        region: request.body.region ?? env.defaultRegion,
        sport: request.body.sport ?? "all",
        matches: request.body.matches ?? []
      });

      const result = await liveService.refreshStates(payload);
      sendEnvelope(
        response,
        requestId,
        {
          meta: {
            count: result.states.length,
            region: payload.region,
            sport: payload.sport,
            state_refresh_after_seconds: env.liveStateRefreshSeconds,
            discovery_refresh_after_seconds: env.liveDiscoveryRefreshSeconds,
            ai_service_available: env.aiEnabled
          },
          states: result.states,
          failed_matches: result.failed_matches,
          provider_debug: result.provider_debug
        },
        result.warnings
      );
    } catch (error) {
      handleKnownError(response, requestId, error);
    }
  });

  app.get("/api/v1/events/live", async (request, response) => {
    const requestId = createRequestId();
    try {
      const result = await liveService.discover({
        region: String(request.query.region ?? env.defaultRegion),
        sport: String(request.query.sport ?? "all"),
        include_context: true,
        known_matches: []
      });

      sendEnvelope(
        response,
        requestId,
        {
          meta: {
            count: result.events.length,
            region: String(request.query.region ?? env.defaultRegion),
            sport: String(request.query.sport ?? "all"),
            state_refresh_after_seconds: env.liveStateRefreshSeconds,
            discovery_refresh_after_seconds: env.liveDiscoveryRefreshSeconds,
            ai_service_available: env.aiEnabled
          },
          events: result.events,
          provider_debug: result.provider_debug
        },
        result.warnings
      );
    } catch (error) {
      handleKnownError(response, requestId, error, 500);
    }
  });

  app.get("/api/v1/events/live/:matchId", async (request, response) => {
    const requestId = createRequestId();
    try {
      const event = await liveService.getLiveEvent(request.params.matchId);
      if (!event) {
        sendError(
          response,
          requestId,
          404,
          "NOT_FOUND",
          "Match not found.",
          false
        );
        return;
      }

      sendEnvelope(response, requestId, { event });
    } catch (error) {
      handleKnownError(response, requestId, error, 500);
    }
  });

  app.get("/api/v1/events/live/:matchId/context", async (request, response) => {
    const requestId = createRequestId();
    try {
      const context = await liveService.getContext(request.params.matchId);
      if (!context) {
        sendError(
          response,
          requestId,
          404,
          "NOT_FOUND",
          "Match context not found.",
          false
        );
        return;
      }

      sendEnvelope(response, requestId, {
        match_id: request.params.matchId,
        context,
        freshness: {
          context_generated_at: context.context_generated_at
        }
      });
    } catch (error) {
      handleKnownError(response, requestId, error, 500);
    }
  });

  app.get("/api/v1/events/live/:matchId/state", async (request, response) => {
    const requestId = createRequestId();
    try {
      const liveState = await liveService.getState(request.params.matchId);
      if (!liveState) {
        sendError(
          response,
          requestId,
          404,
          "NOT_FOUND",
          "Match state not found.",
          false
        );
        return;
      }

      sendEnvelope(response, requestId, {
        match_id: request.params.matchId,
        live_state: liveState,
        freshness: {
          state_generated_at: liveState.freshness.generated_at
        }
      });
    } catch (error) {
      handleKnownError(response, requestId, error, 500);
    }
  });

  app.get("/api/v1/events/upcoming", async (request, response) => {
    const requestId = createRequestId();
    try {
      const payload = upcomingQuerySchema.parse({
        region: String(request.query.region ?? env.defaultRegion),
        sport: String(request.query.sport ?? "all"),
        days: Number(request.query.days ?? env.defaultUpcomingDays)
      });

      const result = await liveService.getUpcoming(payload);
      sendEnvelope(
        response,
        requestId,
        {
          meta: {
            count: result.events.length,
            region: payload.region,
            sport: payload.sport,
            days: payload.days,
            ai_service_available: env.aiEnabled
          },
          events: result.events,
          provider_debug: result.provider_debug
        },
        result.warnings
      );
    } catch (error) {
      handleKnownError(response, requestId, error);
    }
  });

  app.get("/api/v1/events/upcoming/:matchId", async (request, response) => {
    const requestId = createRequestId();
    try {
      const event = await liveService.getUpcomingByMatchId(
        request.params.matchId
      );
      if (!event) {
        sendError(
          response,
          requestId,
          404,
          "NOT_FOUND",
          "Upcoming match not found.",
          false
        );
        return;
      }

      sendEnvelope(response, requestId, { event });
    } catch (error) {
      handleKnownError(response, requestId, error, 500);
    }
  });

  app.use((_request, response) => {
    sendError(
      response,
      createRequestId(),
      404,
      "NOT_FOUND",
      "Route not found.",
      false
    );
  });

  return app;
};
