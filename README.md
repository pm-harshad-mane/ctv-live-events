# CTV Live Events

Local MVP for a live sports intelligence app.

The project has:

- a React + Vite frontend
- a Node + Express API under `/api/v1`
- shared TypeScript + Zod schemas
- switchable provider modes: `mock`, `openai`, `gemini`
- tests for API contracts, provider behavior, and client flows

`README_old.md` is kept as the archived product/spec document. This `README.md` is the repo-level guide for working with the codebase.

## What It Does

The app separates:

- **live discovery**: find currently live matches
- **live state refresh**: refresh only dynamic state on a shorter cadence
- **upcoming retrieval**: fetch upcoming matches and pre-match intelligence

The UI is split into two pages:

- `Live`
- `Upcoming`

Each page uses the same backend API contract that external consumers would use.

## Tech Stack

- React 18
- Vite
- TypeScript
- Express
- Zod
- Vitest
- React Testing Library

## Getting Started

Install dependencies:

```bash
npm install --cache .npm-cache
```

Start the frontend and API together:

```bash
npm run dev --cache .npm-cache
```

Or run them separately:

```bash
npm run dev:server --cache .npm-cache
npm run dev:client --cache .npm-cache
```

Default local URLs:

- UI: `http://127.0.0.1:5173/`
- API: `http://localhost:8787`

## Common Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run check
```

`npm run check` runs:

- `format:check`
- `lint`
- `typecheck`
- `test`
- `build`

## Environment

Create a local `.env` file from `.env.example`.

Important fields:

```env
PORT=8787
USE_MOCK_DATA=true
AI_ENABLED=true
ALLOWED_API_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_DISPLAY_LABEL=ChatGPT 4.5 mini
OPENAI_REQUEST_TIMEOUT_MS=45000

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GEMINI_DISPLAY_LABEL=Gemini 3
GEMINI_REQUEST_TIMEOUT_MS=90000
GEMINI_MAX_OUTPUT_TOKENS=12000

MOCK_DISPLAY_LABEL=MockData
ENABLED_PROVIDER_MODES=mock,openai,gemini
DEFAULT_PROVIDER_MODE=mock
```

## Provider Modes

### Mock

Recommended for normal local UI work.

- no paid API usage
- predictable seeded sports data
- supports all sports currently exposed in the UI

### OpenAI

Uses the OpenAI Responses API with structured JSON output and web search support.

### Gemini

Uses Gemini `generateContent` with Google Search enabled.

Current note:

- Gemini is allowed to return usable results even when grounding metadata is missing
- in that case the API keeps `provider_debug` data, but the UI hides verbose Gemini debug lines

## API Overview

Base path:

```text
/api/v1
```

Useful endpoints:

- `GET /api/v1/config`
- `GET /api/v1/health`
- `GET /api/v1/events/live`
- `POST /api/v1/events/live/discover`
- `POST /api/v1/events/live/state`
- `GET /api/v1/events/live/:matchId`
- `GET /api/v1/events/live/:matchId/context`
- `GET /api/v1/events/live/:matchId/state`
- `GET /api/v1/events/upcoming`
- `GET /api/v1/events/upcoming/:matchId`
- `GET /api/v1/openapi.json`

Example health check:

```bash
curl -s http://localhost:8787/api/v1/health
```

Example config check:

```bash
curl -s http://localhost:8787/api/v1/config
```

## Repo Structure

```text
src/
  client/
    components/    React UI components
    hooks/         client state and polling logic
    lib/           API client and presentation helpers
    App.tsx        top-level app shell
  server/
    config/        env parsing
    gemini/        Gemini transport
    http/          auth and CORS helpers
    openai/        OpenAI prompts, schemas, transport
    openapi/       OpenAPI document source
    providers/
      gemini/      Gemini provider wrappers
      mock/        mock datasets and provider implementations
      openai/      OpenAI provider wrappers
      structured-search/ shared provider logic
    runtime/       active provider mode state
    services/      app service wiring
    createApp.ts   Express app factory
    index.ts       local server entrypoint
  shared/
    schemas/       shared Zod API contracts
    types/         shared API envelope types
tests/
  api/             API and provider tests
  client/          client rendering and UX tests
openapi/
  openapi.json     served OpenAPI document
```

## Current UI Behavior

- separate `Live` and `Upcoming` pages
- model selector next to the page nav
- `MockData`, `ChatGPT 4.5 mini`, and `Gemini 3` can be enabled through env config
- in paid-provider mode, the app does not auto-fetch until the user clicks load
- live polling can be enabled or paused from the UI
- detail modals use already-fetched card data instead of making extra detail fetches

## Supported Sports

Current sports exposed in the app:

- American Football
- Baseball
- Basketball
- Cricket
- Hockey
- MMA
- Soccer
- Tennis

Mock mode includes seeded live/upcoming data for all of them.

## Testing

Targeted examples:

```bash
npm test -- --run tests/api/app.test.ts
npm test -- --run tests/api/openaiProviders.test.ts
npm test -- --run tests/api/geminiProviders.test.ts
npm test -- --run tests/client/app.test.tsx
```

## Notes

- The API root `/` intentionally does not serve an app page; use `/api/v1/...` endpoints instead.
- The current deployment target is local-first. Cloudflare runtime migration is not wired yet.
- If you are using a machine with a broken global npm cache, the repo-local `.npm-cache` workaround is already supported in the commands above.
