# ctv-live-events

## Current implementation status

The repository now contains a local MVP with:

* A React + Vite frontend.
* A Node/Express API that mirrors the intended `/api/v1` contract.
* Shared TypeScript and Zod schemas.
* Mock providers for local development.
* OpenAI-backed provider adapters behind the same interfaces.
* Tests for API contracts, client rendering, kill-switch behavior, and provider prompt separation.

Cloudflare deployment is not wired yet. The project currently runs locally first, with the backend architecture shaped so the runtime can later be moved behind a Worker-compatible implementation.

## Local development

Install dependencies:

```bash
npm install --cache .npm-cache
```

Start the frontend and API together:

```bash
npm run dev --cache .npm-cache
```

Default local URLs:

* Frontend: `http://localhost:5173`
* API: `http://localhost:8787`

Run verification:

```bash
npm run check
```

## Runtime modes

The backend supports two provider modes.

### Mock mode

Default local mode:

```env
USE_MOCK_DATA=true
```

In local mock mode, public read access defaults on unless explicitly overridden. This allows the Vite frontend to call the local API without exposing an external API key in browser code.

### OpenAI mode

To switch the backend from mock providers to OpenAI-backed providers:

```env
USE_MOCK_DATA=false
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5.4-mini
```

For the current local Node/Vite MVP, put those values in a repo-root `.env` file. `.dev.vars` is reserved for the later Cloudflare runtime path.

The current implementation uses the OpenAI Responses API with strict structured JSON output validation. Discovery, state refresh, and upcoming retrieval each use separate prompts and separate schemas.

## Environment variables used by the current MVP

Core runtime:

```env
PORT=8787
USE_MOCK_DATA=true
AI_ENABLED=true
AI_DISABLED_RETRY_AFTER_SECONDS=300
PUBLIC_API_ACCESS=false
ALLOWED_API_ORIGINS=http://localhost:5173
EXTERNAL_API_KEYS=dev-key-1,dev-key-2
```

OpenAI mode:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_REQUEST_TIMEOUT_MS=45000
```

Live and upcoming behavior:

```env
DEFAULT_REGION=north-america
DEFAULT_UPCOMING_DAYS=7
MAX_UPCOMING_DAYS=30
MAX_UPCOMING_EVENTS=100
LIVE_STATE_REFRESH_SECONDS=60
LIVE_DISCOVERY_REFRESH_SECONDS=300
LIVE_CONTEXT_REFRESH_MINUTES=30
MAX_LIVE_EVENTS=50
MAX_CONCURRENT_AI_REQUESTS=3
```

Examples are also provided in [.env.example](./.env.example) and [.dev.vars.example](./.dev.vars.example).

## API workflow in the current app

The frontend already follows the intended split:

1. Load config.
2. Discover live events with context.
3. Refresh live state on the shorter cadence.
4. Re-run live discovery on the slower cadence.
5. Fetch upcoming events separately by region, sport, and days window.

Current live endpoints in use:

* `GET /api/v1/config`
* `GET /api/v1/health`
* `GET /api/v1/events/live/discover`
* `POST /api/v1/events/live/discover`
* `POST /api/v1/events/live/state`
* `GET /api/v1/events/live`
* `GET /api/v1/events/live/:matchId`
* `GET /api/v1/events/live/:matchId/context`
* `GET /api/v1/events/live/:matchId/state`
* `GET /api/v1/events/upcoming`
* `GET /api/v1/events/upcoming/:matchId`
* `GET /api/v1/openapi.json`

## Notes about the current backend

* `AI_ENABLED=false` blocks all AI-backed provider calls and returns `503` for AI-dependent endpoints.
* Health and config endpoints continue to work when AI is disabled.
* Mock and OpenAI providers both implement the same interfaces, so route handlers do not depend on provider-specific logic.
* OpenAI-backed responses are validated before they are returned to the API layer.
* The current detail view in the frontend is in-page and derived from already-fetched data; it does not yet perform separate per-match fetches.

These requirements should override conflicting parts of the earlier Codex prompt. The key architectural change is to separate each live match into:

* Static/context data: fetched once when the match is discovered, or occasionally when explicitly refreshed.
* Dynamic/live data: fetched every 60 seconds using a smaller, cheaper AI request.

Mandatory Architecture Amendment

Apply all requirements in this amendment to the complete Live Sports Intelligence application specification. Where this amendment conflicts with an earlier requirement, this amendment takes precedence.

The project will start in a completely empty folder. There is no existing repository, source code, package configuration, or Cloudflare project.

Build the entire project from scratch and leave it ready to:

* Initialize as a Git repository.
* Push to GitHub or GitLab.
* Connect to Cloudflare Git integration.
* Deploy automatically when the configured production branch changes.
* Expose reusable backend APIs for the web application and authorized external systems.

Do not stop at scaffolding. Implement, test, document, and verify the complete application.

⸻

1. Greenfield project initialization

Because the working folder is empty, perform all necessary initialization.

Create:

* package.json
* TypeScript configuration
* Vite or current Cloudflare-recommended frontend configuration
* React application
* Cloudflare Worker
* Wrangler configuration
* ESLint configuration
* Prettier configuration
* Vitest configuration
* React Testing Library setup
* Optional Playwright configuration
* .gitignore
* .env.example
* .dev.vars.example
* GitHub Actions workflow
* Complete README
* Production and development scripts
* Mock-data fixtures
* Shared API schemas
* OpenAPI specification
* Source-code directory structure
* Test directory structure

Initialize Git locally if the environment permits:

git init

Do not assume that any package manager has already been selected. Prefer npm unless the environment or current official Cloudflare tooling strongly favors another option.

The resulting repository must support commands equivalent to:

npm install
npm run dev
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy

Add a combined verification command:

npm run check

It should run at minimum:

format:check
lint
typecheck
test
build

⸻

2. Backend APIs are first-class product interfaces

The backend is not merely an internal backend-for-frontend.

Design the APIs so that they can be consumed by:

* The bundled web application.
* External ad-tech decision systems.
* Campaign-management systems.
* Internal tools.
* Server-to-server integrations.
* Future automation or alerting systems.

The frontend must consume the same public API contract available to external consumers. Do not create undocumented UI-only response formats.

API design priorities:

1. Stable contracts.
2. Machine-readable JSON.
3. Explicit API versioning.
4. Runtime validation.
5. Consistent error envelopes.
6. CORS configuration.
7. Authentication support.
8. Rate-limiting readiness.
9. Idempotent read behavior.
10. OpenAPI documentation.
11. Backward-compatible evolution.
12. Clear freshness and provenance fields.

⸻

3. API versioning

Place externally consumable endpoints under:

/api/v1

Implement:

GET /api/v1/config
GET /api/v1/health
GET /api/v1/events/live
GET /api/v1/events/live/:matchId
GET /api/v1/events/live/:matchId/context
GET /api/v1/events/live/:matchId/state
GET /api/v1/events/upcoming
GET /api/v1/events/upcoming/:matchId

Also provide an OpenAPI document:

GET /api/v1/openapi.json

Optionally provide human-readable API documentation at:

GET /api/docs

API documentation must describe:

* Authentication.
* Query parameters.
* Response schemas.
* Error schemas.
* Rate-limit behavior.
* Freshness fields.
* Kill-switch behavior.
* Static versus dynamic match data.
* Examples.
* Versioning policy.

Do not expose internal OpenAI prompts through the API documentation.

⸻

4. External API authentication

Support server-to-server API authentication.

Use API keys initially.

Accepted request header:

Authorization: Bearer <api-key>

Optionally also support:

X-API-Key: <api-key>

Prefer the Authorization header and document it as canonical.

Store authorized API keys in a Cloudflare secret or encrypted environment binding, not in source control.

Suggested secret:

EXTERNAL_API_KEYS

It may contain a comma-separated list or JSON array of approved keys.

Example local value:

dev-key-1,dev-key-2

Requirements:

* Never return API keys in responses.
* Never log full API keys.
* Compare keys safely.
* Reject invalid credentials with HTTP 401.
* Use HTTP 403 when a valid credential lacks permission.
* Keep /api/v1/health public.
* The bundled frontend may use same-origin access without exposing a permanent external API key.
* Design same-origin authorization separately from external server-to-server authorization.
* Do not put a privileged API key into browser JavaScript.

For the first version, allow one of these safe approaches:

Preferred approach

* Same-origin browser requests are allowed through a Worker-controlled session or same-origin policy.
* External cross-origin requests require an API key.

Acceptable simpler approach

* Public read access is configurable.
* When public access is disabled, external API keys are required.
* The frontend is served from the same Worker and is recognized as same-origin.

Create configuration:

PUBLIC_API_ACCESS=false
ALLOWED_API_ORIGINS=

CORS requirements:

* Do not use Access-Control-Allow-Origin: * together with privileged access by default.
* Parse an allowlist from ALLOWED_API_ORIGINS.
* Support OPTIONS preflight requests.
* Return the correct CORS headers only for permitted origins.
* Keep same-origin access functional.
* Document how to enable a specific external client.

⸻

5. Backend AI kill switch

Implement a backend-controlled kill switch that immediately prevents new AI usage.

This is a mandatory cost-control and incident-response feature.

Environment variable:

AI_ENABLED=true

Supported values:

true
false

When AI_ENABLED=false:

* Do not call OpenAI.
* Do not perform repair calls.
* Do not invoke AI-backed live refresh.
* Do not invoke AI-backed upcoming-event retrieval.
* Do not silently fall back to another paid AI provider.
* Do not repeatedly retry AI requests.
* Do not expose the OpenAI API key.
* Health checks must continue working.
* Static frontend assets must continue working.
* Configuration endpoint must continue working.
* API authentication must continue working.
* Mock mode may continue working only in local development or explicitly configured non-production environments.

AI-backed endpoints should return:

HTTP 503 Service Unavailable

Example response:

{
  "error": {
    "code": "AI_USAGE_DISABLED",
    "message": "AI-backed sports intelligence is temporarily unavailable.",
    "retryable": false
  },
  "request_id": "req_123",
  "timestamp": "2026-06-16T20:00:00.000Z"
}

Include:

Retry-After: 300

The value may be configurable:

AI_DISABLED_RETRY_AFTER_SECONDS=300

The public configuration endpoint may safely expose:

{
  "ai_service_available": false
}

Do not expose why it was disabled or any internal incident details.

The web UI must show a clear degraded-state message:

Live sports intelligence is temporarily unavailable.

Do not continuously call disabled endpoints every 60 seconds.

When the frontend receives AI_USAGE_DISABLED:

* Stop automatic live refresh attempts.
* Stop the countdown.
* Show a disabled-service state.
* Allow a manual retry button.
* Optionally recheck service configuration at a lower frequency, such as every five minutes.
* Resume normal refresh only after the backend reports that AI is enabled again.

⸻

6. Emergency runtime kill switch

Environment variables deployed through Cloudflare often require a deployment or configuration propagation step. Design the kill-switch abstraction so it can later be backed by a remote control source without changing route logic.

Create an interface similar to:

interface AiAccessController {
  isAiEnabled(): Promise<boolean>;
}

Initial implementation:

EnvironmentAiAccessController

It reads:

AI_ENABLED

The service layer and routes must depend on the interface rather than reading the environment variable throughout the codebase.

Document future options such as:

* Cloudflare KV control flag.
* Cloudflare configuration store.
* Cloudflare Access-protected administration endpoint.
* Feature-flag provider.

Do not implement persistent KV storage now unless explicitly required. The initial implementation must remain environment-variable based and comply with the no-storage requirement.

⸻

7. Optional API-level usage controls

Add configurable limits:

MAX_LIVE_EVENTS=50
MAX_UPCOMING_EVENTS=100
MAX_UPCOMING_DAYS=30
MAX_REQUESTS_PER_MINUTE_PER_KEY=30
MAX_CONCURRENT_AI_REQUESTS=3

Implement lightweight in-instance protection where practical, but clearly document that reliable distributed rate limiting may require a future Cloudflare rate-limiting product or Durable Object.

At minimum:

* Validate all limits.
* Prevent accidental unbounded event requests.
* Prevent overlapping AI calls from the same frontend session.
* Return HTTP 429 for explicitly detected request-limit violations.
* Include Retry-After where appropriate.
* Design a rate-limiter interface that can be replaced later.

Do not claim in-memory Worker rate limiting provides global enforcement.

⸻

8. Separate static and dynamic match data

For live events, do not request the full match schema from OpenAI every 60 seconds.

Divide the match information into two categories.

8.1 Match context: mostly static or slowly changing

Fetch when:

* A match is first discovered.
* The application does not yet have context for the match.
* The user explicitly requests a full refresh.
* The context refresh TTL has expired.
* A material context-changing event is detected, such as a lineup change, major injury, postponement, venue change, or match-stage correction.

Suggested context refresh TTL:

LIVE_CONTEXT_REFRESH_MINUTES=30

Static or slowly changing context includes:

* Match ID.
* Sport.
* League.
* Tournament.
* Season.
* Match name.
* Match type.
* Tournament stage.
* Scheduled start time.
* Venue.
* Participants.
* Participant short names.
* Home/away designation.
* Rankings.
* Recent form.
* Key players.
* Player roles.
* Player importance.
* Initial player availability.
* Rivalry information.
* Head-to-head history.
* Qualification implications.
* Elimination implications.
* Championship implications.
* Historical significance.
* Records and milestones.
* Pre-match anticipation.
* Pre-match predictions.
* Original pre-match win probabilities.
* Expected competitiveness.
* Expected score.
* Key matchup.
* Weather context.
* Pre-match summary.

Use the name:

match_context

or:

context

Do not include frequently changing live score information in this object.

8.2 Match state: highly dynamic

Fetch every live refresh interval.

Dynamic live data includes:

* Current status.
* Current phase.
* Current score.
* Match clock.
* Elapsed or remaining time.
* Current innings, over, quarter, period, set, game, lap, or round.
* Current possession or control.
* What is happening now.
* Last major event.
* A small recent-events list.
* Lead changes when updated.
* Special match state.
* Excitement.
* Criticality.
* Competitive balance.
* Momentum.
* Current win probabilities.
* Win-probability changes.
* Comeback probability.
* Upset probability.
* Draw probability.
* Overtime or tie-break probability.
* Likely next major event.
* Expected remaining duration.
* Live summary.

Use the name:

live_state

The 60-second refresh request should primarily fetch live_state, not the full match context.

⸻

9. Canonical live-event representation

The full representation returned to clients may combine context and current state:

{
  "match_id": "basketball:nba:2026-06-16:bos:gsw",
  "context": {
    "match": {},
    "participants": [],
    "match_context": {},
    "pre_match_intelligence": {}
  },
  "live_state": {
    "match_status": "live",
    "state": {},
    "live_intelligence": {},
    "summary": {}
  },
  "freshness": {
    "context_generated_at": "2026-06-16T19:30:00.000Z",
    "state_generated_at": "2026-06-16T20:04:00.000Z",
    "context_age_seconds": 2040,
    "state_age_seconds": 4
  }
}

The external full-event API should return this combined representation.

The state-only endpoint should return:

{
  "match_id": "basketball:nba:2026-06-16:bos:gsw",
  "live_state": {},
  "freshness": {
    "state_generated_at": "2026-06-16T20:04:00.000Z"
  }
}

The context-only endpoint should return:

{
  "match_id": "basketball:nba:2026-06-16:bos:gsw",
  "context": {},
  "freshness": {
    "context_generated_at": "2026-06-16T19:30:00.000Z"
  }
}

⸻

10. Live-event discovery versus live-state refresh

Implement two distinct AI workflows.

Workflow A: live-event discovery

Purpose:

* Determine which relevant events are currently live.
* Discover new live matches.
* Detect matches that have ended or disappeared.
* Retrieve context for newly discovered matches.

This is a relatively larger request.

It should run:

* On initial page load.
* When region changes.
* When sport filter changes.
* On explicit “full refresh.”
* On a slower configurable cadence.

Suggested cadence:

LIVE_DISCOVERY_REFRESH_SECONDS=300

Default:

300 seconds

Discovery response should be compact and should not retrieve every deep field for every known match unnecessarily.

It should return at least:

{
  "matches": [
    {
      "match_id": "stable-id",
      "sport": "basketball",
      "tournament_name": "NBA",
      "participants": [
        {
          "participant_id": "bos",
          "name": "Boston Celtics"
        },
        {
          "participant_id": "gsw",
          "name": "Golden State Warriors"
        }
      ],
      "status": "live",
      "scheduled_start_time": "2026-06-16T19:00:00Z",
      "context_required": true
    }
  ]
}

After discovery:

* Reuse existing context for known matches.
* Request full context only for new matches or stale context.
* Refresh live state for all active matches.
* Remove or finalize matches no longer live.

Workflow B: state-only live refresh

Purpose:

* Refresh fast-changing data for already-known live matches.

Run every:

LIVE_STATE_REFRESH_SECONDS=60

For each known active match, send the model only the minimum identity and context necessary to find and verify the match.

Example request input:

{
  "current_time_utc": "2026-06-16T20:04:00.000Z",
  "region": "north-america",
  "matches": [
    {
      "match_id": "basketball:nba:2026-06-16:bos:gsw",
      "sport": "basketball",
      "tournament": "NBA",
      "scheduled_start_time": "2026-06-16T19:00:00Z",
      "participants": [
        {
          "participant_id": "bos",
          "name": "Boston Celtics"
        },
        {
          "participant_id": "gsw",
          "name": "Golden State Warriors"
        }
      ]
    }
  ]
}

Ask only for:

* Current status.
* Score.
* Clock/progression.
* Current situation.
* Recent major event.
* Excitement.
* Criticality.
* Competitive balance.
* Momentum.
* Current predictions.
* Short live summary.

Do not ask again for:

* Full venue data.
* Historical head-to-head.
* Rivalry history.
* Full player biographies.
* Pre-match anticipation factors.
* Static tournament details.
* Historical significance unless it has materially changed.
* Full qualification explanation.
* Full records list.
* Repeated static key-player details.

⸻

11. No persistent server-side storage constraint

The system still must not use a persistent application database.

Do not use:

* D1.
* KV for match data.
* R2.
* Durable Objects for match storage.
* External databases.
* Persistent match-history storage.

This means the initial version should use a client-assisted context model.

Client-assisted context approach

The browser retains the current match context in memory for the duration of the page session.

For state refresh, the frontend sends a compact list of currently known live matches to the Worker.

Example:

POST /api/v1/events/live/state
Content-Type: application/json

Request:

{
  "region": "north-america",
  "sport": "all",
  "matches": [
    {
      "match_id": "basketball:nba:2026-06-16:bos:gsw",
      "sport": "basketball",
      "tournament_name": "NBA",
      "scheduled_start_time": "2026-06-16T19:00:00Z",
      "participants": [
        {
          "participant_id": "bos",
          "name": "Boston Celtics"
        },
        {
          "participant_id": "gsw",
          "name": "Golden State Warriors"
        }
      ]
    }
  ]
}

Response:

{
  "generated_at": "2026-06-16T20:04:05.000Z",
  "states": [
    {
      "match_id": "basketball:nba:2026-06-16:bos:gsw",
      "live_state": {},
      "warnings": []
    }
  ]
}

The client then merges the new state into the previously held context by match_id.

This avoids persistent backend storage while avoiding full static-data retrieval every 60 seconds.

External API consumers may use the same workflow:

1. Call discovery/full endpoint.
2. Retain match context in their own runtime.
3. Call state-only refresh endpoint with compact match identities.
4. Merge state updates using match_id.

Document this integration pattern clearly.

⸻

12. Revised live API endpoints

Implement:

GET /api/v1/events/live/discover
POST /api/v1/events/live/state
GET /api/v1/events/live
GET /api/v1/events/live/:matchId

GET /api/v1/events/live/discover

Purpose:

* Discover currently live matches.
* Return context for newly discovered matches.
* Support initial application load.
* Support full refresh.

Query parameters:

region
sport
include_context=true|false

Default:

include_context=true

Response:

{
  "request": {
    "region": "north-america",
    "sport": "all",
    "include_context": true
  },
  "generated_at": "2026-06-16T20:00:05.000Z",
  "discovery_refresh_after_seconds": 300,
  "state_refresh_after_seconds": 60,
  "events": [],
  "warnings": []
}

POST /api/v1/events/live/state

Purpose:

* Efficiently refresh dynamic state for known live matches.
* Avoid retrieving static context.

Input limits:

Maximum matches per request: 50

Validate:

* Stable match ID.
* Sport.
* Tournament name.
* Scheduled start time.
* Participant IDs and names.
* Request-body size.

Return only state data.

GET /api/v1/events/live

Convenience endpoint for external consumers.

Purpose:

* Return complete combined live-event objects.
* Useful for consumers that do not want to manage discovery and state calls separately.

This endpoint may perform a complete discovery/context/state request and therefore may cost more.

Document:

For frequent polling, use /discover followed by /state rather than repeatedly polling the complete /live endpoint.

The web frontend must use the efficient discovery plus state pattern.

GET /api/v1/events/live/:matchId

Return full combined data for one match when it can be located and verified.

Because the service has no persistent storage, this endpoint may require an AI lookup and should be documented as potentially more expensive.

Do not imply that matchId alone maps to a stored server record.

⸻

13. Frontend live refresh algorithm

Implement this behavior.

Initial page load

1. Fetch configuration.
2. Call live discovery with context.
3. Store full live-event objects in React state.
4. Render grouped events.
5. Start:
    * 60-second state-refresh countdown.
    * 300-second discovery-refresh countdown.

Every 60 seconds

1. Collect compact identities of currently known live matches.
2. Call POST /api/v1/events/live/state.
3. Display “Updating live scores and match state…”.
4. Keep existing cards visible.
5. Merge returned states by match_id.
6. Preserve existing context.
7. Remove no static information.
8. Mark individual failed match updates as stale.
9. Reset state-refresh countdown after the request completes.

Every 300 seconds

1. Call discovery.
2. Detect newly live matches.
3. Add new match contexts.
4. Detect matches no longer live.
5. Remove completed matches from “Current Live Events.”
6. Reconcile corrected tournament or participant identity.
7. Run state refresh for the resulting active set.
8. Reset discovery countdown.

Do not necessarily display the slower discovery countdown prominently. The visible primary countdown should represent the next 60-second state refresh.

The UI may show a smaller secondary label:

Searching for newly started matches every 5 minutes

Region or sport filter change

1. Abort all in-progress discovery and state calls.
2. Clear current live context for the previous filter.
3. Run a fresh discovery request with context.
4. Restart both timers.
5. Prevent old responses from overwriting new-filter results.

Manual refresh actions

Provide two possible actions:

Primary:

Refresh live state

This runs only the low-cost state refresh.

Secondary menu/action:

Find new live matches

This runs full discovery.

Optionally provide:

Full refresh

This performs discovery, context retrieval for new/stale matches, and state refresh.

Label the actions clearly so users understand that “Refresh live state” is faster.

⸻

14. Refresh request batching

Prefer one batched state-refresh AI request for all known live matches when model capabilities and response size permit.

Do not automatically make one OpenAI call per match unless necessary.

Implement configurable batching:

LIVE_STATE_BATCH_SIZE=10

Behavior:

* Split known matches into batches.
* Process with bounded concurrency.
* Maximum concurrent AI requests:

MAX_CONCURRENT_AI_REQUESTS=3

Merge results by match_id.

If one batch fails:

* Preserve old states for that batch.
* Mark affected matches stale.
* Continue processing successful batches.
* Return partial-success warnings.

API response should support partial success:

{
  "generated_at": "2026-06-16T20:04:05.000Z",
  "states": [],
  "failed_matches": [
    {
      "match_id": "match-id",
      "code": "STATE_REFRESH_FAILED",
      "message": "State could not be refreshed."
    }
  ],
  "warnings": [
    "One match could not be refreshed."
  ]
}

⸻

15. Context fingerprint and version

Add a context fingerprint to help clients determine whether static context changed.

Example:

{
  "context_version": 1,
  "context_fingerprint": "sha256-base64url-or-short-hash",
  "context_generated_at": "2026-06-16T19:30:00.000Z"
}

The fingerprint should be computed from normalized context fields.

When discovery returns a known match:

* If fingerprint is unchanged, the client may keep existing context.
* If fingerprint changes, return the revised context.
* If context is omitted, return enough metadata to indicate whether the client’s copy remains current.

Allow discovery requests to send known context fingerprints.

Recommended endpoint method:

POST /api/v1/events/live/discover

Request:

{
  "region": "north-america",
  "sport": "all",
  "known_matches": [
    {
      "match_id": "match-id",
      "context_fingerprint": "existing-fingerprint"
    }
  ]
}

Response:

{
  "events": [
    {
      "match_id": "match-id",
      "context_status": "unchanged",
      "context_fingerprint": "existing-fingerprint",
      "context": null,
      "live_state": {}
    },
    {
      "match_id": "new-match-id",
      "context_status": "new",
      "context_fingerprint": "new-fingerprint",
      "context": {},
      "live_state": {}
    }
  ]
}

Allowed values:

new
unchanged
updated
unavailable

This makes discovery efficient without persistent backend storage.

A GET discovery endpoint may remain as a simple convenience method, but the frontend should use POST when sending known fingerprints.

⸻

16. Updated dynamic-state schema

Use a compact state-only schema.

{are 
  "match_id": "basketball:nba:2026-06-16:bos:gsw",
  "match_status": "live",
  "period": {
    "code": "fourth_quarter",
    "display": "4th Quarter"
  },
  "clock": {
    "display": "02:14",
    "elapsed_seconds": 8640,
    "remaining_seconds": 134
  },
  "score": {
    "participant_scores": [
      {
        "participant_id": "bos",
        "display_score": "102",
        "numeric_score": 102
      },
      {
        "participant_id": "gsw",
        "display_score": "100",
        "numeric_score": 100
      }
    ],
    "display": "102–100",
    "score_differential": 2
  },
  "sport_specific": {},
  "current_possession_or_control": {
    "participant_id": "gsw",
    "description": "Golden State has possession"
  },
  "what_is_happening": {
    "headline": "Two-point game with just over two minutes remaining",
    "summary": "Golden State has reduced a double-digit deficit to two.",
    "situation_code": "close_finish",
    "key_entity_ids": [
      "bos",
      "gsw"
    ]
  },
  "last_major_event": {
    "event_id": "event-id",
    "event_type": "score",
    "participant_id": "gsw",
    "player_id": "player-id",
    "description": "Three-pointer reduced the lead to two",
    "match_time": "02:14 Q4",
    "event_importance": 91
  },
  "recent_events": [],
  "special_state": {
    "is_timeout": false,
    "is_under_review": false,
    "is_injury_delay": false,
    "is_weather_delay": false,
    "is_overtime_or_tiebreak": false
  },
  "excitement": {
    "aggregate_score": 94,
    "level": "extreme",
    "current_excitement": 94,
    "recent_excitement": 96,
    "expected_remaining_excitement": 92,
    "reason_codes": [
      "close_score",
      "late_match",
      "active_comeback"
    ]
  },
  "criticality": {
    "score": 97,
    "level": "decisive",
    "reason_codes": [
      "late_match",
      "close_score",
      "championship_implications"
    ]
  },
  "competitive_balance": {
    "score": 93,
    "level": "very_close"
  },
  "momentum": {
    "leading_participant_id": "gsw",
    "score": 82,
    "direction": "increasing",
    "summary": "Golden State has gained momentum through a sustained scoring run",
    "reason_codes": [
      "accelerated_scoring",
      "win_probability_gain"
    ]
  },
  "live_predictions": {
    "win_probabilities": [
      {
        "participant_id": "bos",
        "probability": 0.56
      },
      {
        "participant_id": "gsw",
        "probability": 0.44
      }
    ],
    "win_probability_changes": [
      {
        "participant_id": "bos",
        "last_interval": -0.18
      },
      {
        "participant_id": "gsw",
        "last_interval": 0.18
      }
    ],
    "comeback_probability": 0.44,
    "upset_probability": 0.38,
    "draw_probability": 0.01,
    "overtime_or_tiebreak_probability": 0.03,
    "likely_next_major_event": "score",
    "expected_remaining_duration_minutes": 12,
    "prediction_confidence": 0.86
  },
  "summary": {
    "headline": "Close championship game enters a decisive final phase",
    "short_byte": "Boston leads 102–100 with 2:14 remaining, but Golden State has strong momentum.",
    "key_points": [
      "The game is within one possession",
      "Excitement is extreme",
      "The current phase is decisive"
    ]
  },
  "freshness": {
    "generated_at": "2026-06-16T20:04:05.000Z",
    "source_observation_time": null
  }
}

Do not repeat static tournament and participant details in every state response.

⸻

17. Model prompts for efficient state refresh

Create a dedicated state-refresh prompt.

It must explicitly say:

You are refreshing only the dynamic state of already-known live sports matches.
Do not return static match context unless required to correct identity.
Do not repeat venue, rivalry history, full participant profiles, full head-to-head history, pre-match anticipation factors, or other static fields.
For each supplied match:
1. Verify whether it is still live.
2. Return the current status.
3. Return the most recent verifiable score and progression.
4. Summarize what is happening now.
5. Return only recent meaningful events.
6. Update excitement, criticality, competitive balance, momentum, and live predictions.
7. Keep summaries concise.
8. Do not invent precision.
9. If the match has completed, return status=completed and the final score when verifiable.
10. If the match cannot be verified, return an explicit unverified status or a per-match warning.

Use strict structured output.

Keep the state schema substantially smaller than the complete event schema.

⸻

18. Data-provenance fields for external systems

External systems need to understand freshness and uncertainty.

Include fields such as:

{
  "freshness": {
    "generated_at": "2026-06-16T20:04:05.000Z",
    "source_observation_time": null,
    "age_seconds": 3
  },
  "verification": {
    "status": "verified",
    "confidence": 0.9,
    "warnings": []
  }
}

Allowed verification statuses:

verified
partially_verified
unverified
conflicting_sources

Do not imply that generated_at is the same as the time a score changed.

Document that the API is AI-generated intelligence and is not guaranteed to match a licensed real-time sports feed.

⸻

19. API response metadata

All external API responses should include:

{
  "api_version": "v1",
  "request_id": "req_123",
  "generated_at": "2026-06-16T20:04:05.000Z",
  "data": {},
  "warnings": []
}

For collections, include:

{
  "meta": {
    "count": 12,
    "region": "north-america",
    "sport": "all",
    "state_refresh_after_seconds": 60,
    "discovery_refresh_after_seconds": 300,
    "ai_service_available": true
  }
}

Do not place transport metadata separately inside every match unless it is match-specific.

⸻

20. OpenAPI specification

Generate and maintain:

openapi/openapi.yaml

or:

openapi/openapi.json

The runtime endpoint /api/v1/openapi.json should serve the generated or source specification.

Document:

* Every endpoint.
* Request body schemas.
* Response schemas.
* Authentication schemes.
* API-key security.
* Error responses.
* Examples.
* Kill-switch 503 response.
* State-only refresh workflow.
* Discovery workflow.
* Complete convenience endpoint.
* Polling recommendations.
* Request limits.
* Partial-success response.
* Deprecated-field policy.

Add tests that verify the OpenAPI document exists and is valid JSON/YAML.

Prefer generating TypeScript types from one authoritative schema or carefully keeping types and the OpenAPI schema synchronized.

Do not manually maintain multiple contradictory schemas.

⸻

21. External-consumer integration documentation

Add a README section titled:

Integrating an External Decision System

Include this recommended workflow:

1. Call POST /api/v1/events/live/discover.
2. Retain returned match context keyed by match_id.
3. Poll POST /api/v1/events/live/state every 60 seconds.
4. Merge state into retained context by match_id.
5. Re-run discovery every five minutes.
6. Stop polling matches returned as completed, cancelled, postponed, or abandoned.
7. Handle partial-success warnings and stale states.
8. Respect Retry-After and rate-limit responses.

Provide a TypeScript example:

type KnownMatchIdentity = {
  match_id: string;
  sport: string;
  tournament_name: string;
  scheduled_start_time: string;
  participants: Array<{
    participant_id: string;
    name: string;
  }>;
};
async function refreshLiveStates(
  apiBaseUrl: string,
  apiKey: string,
  matches: KnownMatchIdentity[]
) {
  const response = await fetch(`${apiBaseUrl}/api/v1/events/live/state`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      region: "north-america",
      sport: "all",
      matches
    })
  });
  if (!response.ok) {
    throw new Error(`State refresh failed: ${response.status}`);
  }
  return response.json();
}

Also provide curl examples without real credentials.

⸻

22. Revised environment variables

Document all variables:

OPENAI_API_KEY=
OPENAI_MODEL=
AI_ENABLED=true
AI_DISABLED_RETRY_AFTER_SECONDS=300
PUBLIC_API_ACCESS=false
EXTERNAL_API_KEYS=
ALLOWED_API_ORIGINS=
DEFAULT_REGION=north-america
DEFAULT_UPCOMING_DAYS=7
MAX_UPCOMING_DAYS=30
LIVE_STATE_REFRESH_SECONDS=60
LIVE_DISCOVERY_REFRESH_SECONDS=300
LIVE_CONTEXT_REFRESH_MINUTES=30
LIVE_STATE_BATCH_SIZE=10
MAX_LIVE_EVENTS=50
MAX_UPCOMING_EVENTS=100
MAX_CONCURRENT_AI_REQUESTS=3
MAX_REQUESTS_PER_MINUTE_PER_KEY=30
OPENAI_REQUEST_TIMEOUT_MS=45000
USE_MOCK_DATA=false

Use safe defaults when optional variables are absent.

Fail clearly when required production secrets are absent.

Do not fail /health because OpenAI is disabled.

⸻

23. Health and readiness behavior

Implement:

GET /api/v1/health

Example:

{
  "status": "ok",
  "service": "live-sports-intelligence",
  "timestamp": "2026-06-16T20:00:00.000Z",
  "api_version": "v1"
}

Optionally implement:

GET /api/v1/readiness

Example when AI is enabled and configured:

{
  "status": "ready",
  "ai_usage_enabled": true,
  "openai_configured": true
}

Example when kill switch is active:

{
  "status": "degraded",
  "ai_usage_enabled": false,
  "openai_configured": true
}

Do not make an OpenAI request merely to perform a health or readiness check.

Do not expose secret values.

⸻

24. Revised tests

Add tests covering these new requirements.

Kill-switch tests

* AI-enabled request invokes mocked AI service.
* AI-disabled request never invokes AI service.
* AI-disabled endpoint returns HTTP 503.
* Retry-After is present.
* Health endpoint still works.
* Config safely reports unavailable AI service.
* Frontend stops automatic refresh after kill-switch response.
* Manual retry works.
* Automatic refresh resumes after service availability returns.

Static/dynamic split tests

* Initial discovery returns context plus live state.
* State refresh returns no static context.
* Client merges state without deleting context.
* New match discovered after initial load is added.
* Completed match is removed from live section.
* Unchanged context fingerprint avoids replacing context.
* Updated context fingerprint replaces context.
* State failure preserves previous state.
* Partial batch failure marks only affected matches stale.
* Region change aborts old state and discovery requests.
* Discovery and state timers operate independently.

External API tests

* Missing API key is rejected when required.
* Valid API key succeeds.
* Invalid API key is rejected.
* Public health endpoint succeeds without a key.
* CORS allows configured origins.
* CORS rejects unknown origins.
* OPTIONS preflight behaves correctly.
* API response envelope is consistent.
* OpenAPI endpoint returns a valid document.
* Request-body match-count limit is enforced.
* Oversized request returns an appropriate error.

AI usage tests

Verify through mocks that:

* Discovery uses the discovery prompt/schema.
* Context retrieval uses the context prompt/schema.
* State refresh uses the smaller state prompt/schema.
* Upcoming retrieval uses the upcoming prompt/schema.
* State refresh does not request static context fields.
* Repair logic respects the kill switch.
* Batching respects concurrency limits.

⸻

25. Revised definition of done

In addition to all previously specified requirements, the project is complete only when:

1. It is created fully from an empty folder.
2. All repository and package files are generated.
3. APIs are versioned under /api/v1.
4. APIs are documented for external consumers.
5. An OpenAPI specification is provided.
6. External API-key authentication is implemented.
7. CORS is configurable and safe.
8. A backend AI_ENABLED kill switch is implemented.
9. Disabled AI usage produces no OpenAI calls.
10. The frontend handles disabled AI gracefully.
11. Live discovery is separate from live-state refresh.
12. Static match context is not requested every 60 seconds.
13. Live state can be refreshed through a state-only API.
14. The frontend merges context and state by stable match_id.
15. Discovery runs on a slower cadence than state refresh.
16. External systems can use the same discovery/state workflow.
17. State refresh supports batching and partial success.
18. No persistent server-side match database is introduced.
19. Context fingerprints are supported.
20. Tests prove the static/dynamic separation.
21. Tests prove the kill switch prevents paid AI usage.
22. The README includes external integration examples.
23. Cloudflare deployment and Git auto-deployment are documented.
24. All quality checks and the production build pass.

⸻

26. Final implementation directive

Make architectural decisions that minimize repeated AI usage while preserving freshness.

The preferred request model is:

Initial load:
full live discovery + context + current state
Every 60 seconds:
dynamic state only
Every 5 minutes:
live-event discovery and context reconciliation
Upcoming-event filter change or manual refresh:
upcoming context and predictions
AI kill switch disabled:
no AI call under any circumstances

Build shared interfaces so the source of dynamic sports data could later be replaced by a licensed sports-data provider without rewriting the frontend or external API contract.

Use adapters such as:

interface LiveEventDiscoveryProvider {
  discover(input: DiscoveryInput): Promise<DiscoveryResult>;
}
interface LiveEventStateProvider {
  refreshStates(input: StateRefreshInput): Promise<StateRefreshResult>;
}
interface UpcomingEventProvider {
  getUpcoming(input: UpcomingInput): Promise<UpcomingResult>;
}

Implement OpenAI-backed adapters initially:

OpenAiLiveEventDiscoveryProvider
OpenAiLiveEventStateProvider
OpenAiUpcomingEventProvider

Keep route handlers independent of OpenAI-specific implementation details.

Deliver a complete, tested, secure, responsive, and Cloudflare-deployable greenfield project.

A practical request pattern for the finished application would therefore be:

Page load                 → Discover live matches and retrieve full context
Every 60 seconds          → Refresh score, clock, situation and live metrics only
Every 5 minutes           → Detect newly started or completed matches
Upcoming filter changes   → Regenerate upcoming-match information
AI_ENABLED=false          → Reject AI-backed requests without invoking OpenAI
