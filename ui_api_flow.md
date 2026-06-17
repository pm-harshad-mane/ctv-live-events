# UI API Flow

This document explains how the current UI talks to the backend, which API calls are made, when they are made, and the request/response payload shapes the UI depends on.

The source of truth for the current flow is:

- [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts)
- [src/client/hooks/useLiveEvents.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/hooks/useLiveEvents.ts)
- [src/server/createApp.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/server/createApp.ts)
- [src/shared/schemas/live.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/shared/schemas/live.ts)
- [src/shared/types/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/shared/types/api.ts)

## Base URL

In the browser, the client calls relative API paths:

```text
/api/v1/...
```

During local development:

- UI: `http://127.0.0.1:5173`
- API: `http://localhost:8787`

Vite proxies the browser requests to the local API server.

## High-Level Flow

The UI has 2 main pages:

- `Live`
- `Upcoming`

The shared hook `useLiveEvents()` drives all API access.

Main flow:

1. Load config.
2. Show provider mode and UI behavior based on config.
3. On the `Live` page:
   - load live matches when requested
   - optionally refresh live state on a timer
   - optionally re-run discovery on a slower timer
4. On the `Upcoming` page:
   - load upcoming matches when requested
5. `More Details` does not make another network call.
   - live modal uses already-loaded `events`
   - upcoming modal uses already-loaded `upcomingEvents`

## Auto vs Manual Loading

The UI behaves differently depending on `config.use_mock_data`.

### Mock mode

If `use_mock_data=true`:

- live data auto-loads
- upcoming data auto-loads
- periodic live updates are enabled by default

### Paid provider mode

If `use_mock_data=false`:

- live data does not auto-load
- upcoming data does not auto-load
- user must click:
  - `Load live matches`
  - `Load upcoming matches`
- periodic live updates are off by default

## Common Envelope Shape

Most successful API responses use this envelope:

```json
{
  "api_version": "v1",
  "request_id": "req_123",
  "generated_at": "2026-06-17T18:00:00.000Z",
  "data": {},
  "warnings": []
}
```

Error responses use:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Request failed.",
    "retryable": false
  },
  "request_id": "req_123",
  "timestamp": "2026-06-17T18:00:00.000Z"
}
```

The client throws `ApiError` when `response.ok === false`.

## 1. Config Load

### Endpoint

```http
GET /api/v1/config
```

### Called from

- `fetchConfig()` in [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts)
- initial effect in [src/client/hooks/useLiveEvents.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/hooks/useLiveEvents.ts)

### When it is called

- once on initial app load
- again when `reloadToken` changes
- again after model switching

### Response data shape used by UI

```json
{
  "api_version": "v1",
  "ai_service_available": true,
  "discovery_refresh_after_seconds": 300,
  "state_refresh_after_seconds": 60,
  "max_live_events": 50,
  "public_api_access": true,
  "use_mock_data": true,
  "active_model": "mock",
  "available_models": [
    { "id": "mock", "label": "MockData" },
    { "id": "openai", "label": "ChatGPT 4.5 mini" },
    { "id": "gemini", "label": "Gemini 3" }
  ]
}
```

### Why the UI needs it

- determine whether loading is automatic or manual
- initialize countdown durations
- populate the model selector
- know the current active provider mode

## 2. Switch Active Model

### Endpoint

```http
POST /api/v1/runtime/model
```

### Request body

```json
{
  "model": "gemini"
}
```

Allowed values:

- `mock`
- `openai`
- `gemini`

### Called from

- `switchActiveModel()` in [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts)

### When it is called

- when the user changes the `Data Source` selector

### Response

Same shape as `GET /api/v1/config`.

### UI behavior after success

The hook resets:

- live events
- upcoming events
- warnings
- selected detail state
- fetch triggers
- countdowns

Then it re-applies the new mode rules:

- mock mode resumes automatic behavior
- paid modes remain manual

## 3. Discover Live Events

### Endpoint

```http
POST /api/v1/events/live/discover
```

### Called from

- `discoverLiveEvents()` in [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts)

### When it is called

- when the user clicks `Load live matches`
- when the user clicks `Find new live matches`
- automatically on a slower timer in mock mode or when periodic updates are enabled and the live page is already loaded

### Request body

Initial load:

```json
{
  "region": "north-america",
  "sport": "soccer",
  "include_context": true
}
```

Rediscovery after data already exists:

```json
{
  "region": "north-america",
  "sport": "soccer",
  "include_context": true,
  "known_matches": [
    {
      "match_id": "fifa_wc_2026_m23_por_cod",
      "context_fingerprint": "ctx_por_cod_v1"
    }
  ]
}
```

### Response data shape

```json
{
  "request": {
    "region": "north-america",
    "sport": "soccer",
    "include_context": true
  },
  "meta": {
    "count": 1,
    "region": "north-america",
    "sport": "soccer",
    "state_refresh_after_seconds": 60,
    "discovery_refresh_after_seconds": 300,
    "ai_service_available": true
  },
  "events": [
    {
      "match_id": "fifa_wc_2026_m23_por_cod",
      "context_status": "new",
      "context_fingerprint": "ctx_por_cod_v1",
      "context": {
        "match": {
          "match_id": "fifa_wc_2026_m23_por_cod",
          "match_name": "Portugal vs DR Congo",
          "sport": "soccer",
          "tournament_name": "FIFA World Cup",
          "tournament_stage": "Group Stage",
          "scheduled_start_time": "2026-06-17T17:00:00Z",
          "venue": {
            "stadium": "Houston Stadium",
            "city": "Houston",
            "state": "Texas",
            "country": "United States"
          }
        },
        "participants": [],
        "pre_match_intelligence": {
          "headline": "Portugal favored",
          "summary": "Portugal is expected to control most phases.",
          "expected_competitiveness": 45,
          "key_matchup": "Portugal attack vs DR Congo defense"
        },
        "context_version": 1,
        "context_fingerprint": "ctx_por_cod_v1",
        "context_generated_at": "2026-06-17T18:12:32Z"
      },
      "live_state": {
        "match_id": "fifa_wc_2026_m23_por_cod",
        "match_status": "live",
        "period": {
          "code": "second_half",
          "display": "2nd Half"
        },
        "clock": {
          "display": "47:00",
          "elapsed_seconds": 2820,
          "remaining_seconds": 2580
        },
        "score": {
          "participant_scores": [],
          "display": "1-1",
          "score_differential": 0
        },
        "sport_specific": {},
        "current_possession_or_control": {
          "participant_id": "por",
          "description": "Portugal is retaining possession."
        },
        "active_players": [],
        "what_is_happening": {
          "headline": "Match level in the second half",
          "summary": "Portugal and DR Congo are tied.",
          "situation_code": "tied_game_second_half",
          "key_entity_ids": []
        },
        "last_major_event": {
          "event_id": "goal_1",
          "event_type": "goal",
          "participant_id": "cod",
          "player_id": "yoane_wissa",
          "description": "DR Congo equalized before half-time.",
          "match_time": "45+5'",
          "event_importance": 95
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
          "aggregate_score": 82,
          "level": "high",
          "current_excitement": 85,
          "recent_excitement": 95,
          "expected_remaining_excitement": 80,
          "reason_codes": []
        },
        "criticality": {
          "score": 88,
          "level": "high",
          "reason_codes": []
        },
        "competitive_balance": {
          "score": 75,
          "level": "competitive"
        },
        "momentum": {
          "leading_participant_id": "cod",
          "score": 62,
          "direction": "positive",
          "summary": "DR Congo grabbed momentum.",
          "reason_codes": []
        },
        "live_predictions": {
          "win_probabilities": [],
          "win_probability_changes": [],
          "comeback_probability": 0.25,
          "upset_probability": 0.35,
          "draw_probability": 0.23,
          "overtime_or_tiebreak_probability": 0,
          "likely_next_major_event": "substitution",
          "expected_remaining_duration_minutes": 43,
          "prediction_confidence": 0.75
        },
        "summary": {
          "headline": "Portugal and DR Congo tied",
          "short_byte": "Match level early in the second half.",
          "key_points": []
        },
        "freshness": {
          "generated_at": "2026-06-17T18:12:32Z",
          "source_observation_time": "2026-06-17T18:11:00Z",
          "age_seconds": 92
        },
        "verification": {
          "status": "verified",
          "confidence": 0.98,
          "warnings": []
        }
      },
      "freshness": {
        "context_generated_at": "2026-06-17T18:12:32Z",
        "state_generated_at": "2026-06-17T18:12:32Z",
        "context_age_seconds": 0,
        "state_age_seconds": 0
      }
    }
  ],
  "provider_debug": {}
}
```

### How the UI uses it

- fills the live grid
- seeds all live detail modal content
- stores warnings for the live status panel
- resets state and discovery countdowns

### Important merge rule

When rediscovery runs again, the hook merges results by `match_id`.

If `context_status === "unchanged"`, the existing context is preserved locally and only the new dynamic state is applied.

## 4. Refresh Live State

### Endpoint

```http
POST /api/v1/events/live/state
```

### Called from

- `refreshLiveStates()` in [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts)

### When it is called

- when the user clicks `Refresh live state`
- automatically every `state_refresh_after_seconds` when periodic updates are enabled and live data is already loaded

### Request body

```json
{
  "region": "north-america",
  "sport": "soccer",
  "matches": [
    {
      "match_id": "fifa_wc_2026_m23_por_cod",
      "sport": "soccer",
      "tournament_name": "FIFA World Cup",
      "scheduled_start_time": "2026-06-17T17:00:00Z",
      "participants": [
        {
          "participant_id": "por",
          "name": "Portugal",
          "short_name": "POR"
        },
        {
          "participant_id": "cod",
          "name": "DR Congo",
          "short_name": "COD"
        }
      ]
    }
  ]
}
```

### Response data shape

```json
{
  "meta": {
    "count": 1,
    "region": "north-america",
    "sport": "soccer",
    "state_refresh_after_seconds": 60,
    "discovery_refresh_after_seconds": 300,
    "ai_service_available": true
  },
  "states": [
    {
      "match_id": "fifa_wc_2026_m23_por_cod",
      "match_status": "live",
      "period": {
        "code": "second_half",
        "display": "2nd Half"
      },
      "clock": {
        "display": "53:10",
        "elapsed_seconds": 3190,
        "remaining_seconds": 2210
      },
      "score": {
        "participant_scores": [],
        "display": "1-1",
        "score_differential": 0
      },
      "sport_specific": {},
      "current_possession_or_control": {
        "participant_id": "por",
        "description": "Portugal is controlling the ball."
      },
      "active_players": [],
      "what_is_happening": {
        "headline": "Portugal pressing after the restart",
        "summary": "The game is still level.",
        "situation_code": "tied_game_second_half",
        "key_entity_ids": []
      },
      "last_major_event": {
        "event_id": "goal_1",
        "event_type": "goal",
        "participant_id": "cod",
        "player_id": "yoane_wissa",
        "description": "DR Congo equalized.",
        "match_time": "45+5'",
        "event_importance": 95
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
        "aggregate_score": 84,
        "level": "high",
        "current_excitement": 83,
        "recent_excitement": 80,
        "expected_remaining_excitement": 87,
        "reason_codes": []
      },
      "criticality": {
        "score": 88,
        "level": "high",
        "reason_codes": []
      },
      "competitive_balance": {
        "score": 78,
        "level": "competitive"
      },
      "momentum": {
        "leading_participant_id": "por",
        "score": 61,
        "direction": "positive",
        "summary": "Portugal has the better territory right now.",
        "reason_codes": []
      },
      "live_predictions": {
        "win_probabilities": [],
        "win_probability_changes": [],
        "comeback_probability": 0.2,
        "upset_probability": 0.3,
        "draw_probability": 0.25,
        "overtime_or_tiebreak_probability": 0,
        "likely_next_major_event": "shot_on_target",
        "expected_remaining_duration_minutes": 38,
        "prediction_confidence": 0.75
      },
      "summary": {
        "headline": "Portugal trying to tilt the second half",
        "short_byte": "The match remains level.",
        "key_points": []
      },
      "freshness": {
        "generated_at": "2026-06-17T18:20:00Z",
        "source_observation_time": "2026-06-17T18:19:00Z",
        "age_seconds": 30
      },
      "verification": {
        "status": "verified",
        "confidence": 0.96,
        "warnings": []
      }
    }
  ],
  "failed_matches": [],
  "provider_debug": {}
}
```

### How the UI uses it

- updates only `event.live_state`
- keeps the existing static context
- marks `failed_matches` as stale in the live grid
- updates the status panel warnings

## 5. Fetch Upcoming Events

### Endpoint

```http
GET /api/v1/events/upcoming
```

### Called from

- `fetchUpcomingEvents()` in [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts)

### When it is called

- when the user clicks `Load upcoming matches`
- when the user changes the upcoming window and then loads/reloads
- automatically in mock mode

### Query parameters

```text
region=north-america
sport=soccer
days=7
```

### Response data shape

```json
{
  "meta": {
    "count": 2,
    "region": "north-america",
    "sport": "soccer",
    "days": 7,
    "ai_service_available": true
  },
  "events": [
    {
      "match_id": "soccer:upcoming:1",
      "context": {
        "match": {
          "match_id": "soccer:upcoming:1",
          "match_name": "Inter Miami vs Atlanta United",
          "sport": "soccer",
          "tournament_name": "MLS",
          "tournament_stage": "Regular Season",
          "scheduled_start_time": "2026-06-18T01:00:00Z",
          "venue": {
            "stadium": "Chase Stadium",
            "city": "Fort Lauderdale",
            "state": "Florida",
            "country": "United States"
          }
        },
        "participants": [],
        "pre_match_intelligence": {
          "headline": "High-event MLS matchup",
          "summary": "Both sides can create chances quickly.",
          "expected_competitiveness": 78,
          "key_matchup": "Transition speed vs pressing resistance"
        },
        "context_version": 1,
        "context_fingerprint": "ctx_upcoming_1",
        "context_generated_at": "2026-06-17T18:00:00Z"
      },
      "upcoming_intelligence": {
        "headline": "One of the more volatile fixtures this week",
        "summary": "The game projects as highly watchable.",
        "projected_competitiveness": 79,
        "watch_reasons": [
          "High attacking volatility",
          "Potential playoff positioning impact"
        ],
        "win_probabilities": [
          {
            "participant_id": "mia",
            "probability": 0.52
          },
          {
            "participant_id": "atl",
            "probability": 0.48
          }
        ]
      },
      "freshness": {
        "generated_at": "2026-06-17T18:00:00Z",
        "age_seconds": 22
      }
    }
  ],
  "provider_debug": {}
}
```

### How the UI uses it

- fills the upcoming grid
- seeds all upcoming detail modal content
- shows competitiveness and win probabilities directly in the card
- shows time-left if the match is later today

## 6. Detail Views

The UI currently does not make extra API calls when the user clicks `More Details`.

### Live detail modal

Uses the selected item from:

- `events[]`

The hook copies:

- `context`
- `live_state`

into `selectedLiveMatchDetail`.

### Upcoming detail modal

Uses the selected item from:

- `upcomingEvents[]`

The hook copies the selected event into `selectedUpcomingMatchDetail`.

### API helpers that exist but are not currently used by the UI

These helpers are still present in [src/client/lib/api.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/client/lib/api.ts):

- `fetchLiveMatchContext(matchId)`
- `fetchLiveMatchState(matchId)`
- `fetchUpcomingMatch(matchId)`

Matching backend endpoints:

- `GET /api/v1/events/live/:matchId/context`
- `GET /api/v1/events/live/:matchId/state`
- `GET /api/v1/events/upcoming/:matchId`

They are available for future route-based match pages or deeper lazy-loaded detail views.

## 7. Countdown and Polling Logic

The UI uses 2 countdowns from config:

- `state_refresh_after_seconds`
- `discovery_refresh_after_seconds`

### State refresh countdown

When it reaches `0`:

- UI calls `POST /api/v1/events/live/state`

### Discovery countdown

When it reaches `0`:

- UI calls `POST /api/v1/events/live/discover`

### Important gating rules

Timers only run when:

- config is loaded
- live results have been loaded at least once
- periodic updates are enabled
- AI service is not disabled

## 8. Warnings and Error Handling

### Warnings

Warnings come back in the success envelope:

```json
{
  "data": {},
  "warnings": ["..."]
}
```

UI behavior:

- live warnings show in the live status panel
- upcoming warnings show in the upcoming status panel
- some Gemini debug-oriented warning lines are filtered out in the UI

### Errors

When the API returns non-2xx:

- `requestJson()` throws `ApiError`
- the hook sets:
  - `errorMessage`
  - `statusMessage` or `upcomingStatusMessage`

Special handling:

- `AI_USAGE_DISABLED` puts the app in disabled state
- `AbortError` is ignored

## 9. Provider Debug Payloads

The API can return `provider_debug`.

Current shape:

### OpenAI

```json
{
  "openai_web_search": {
    "required": true,
    "tool_invoked": true,
    "call_count": 1,
    "source_count": 2,
    "sources": ["source-a", "source-b"]
  }
}
```

### Gemini

```json
{
  "gemini_google_search": {
    "required": true,
    "tool_invoked": false,
    "query_count": 0,
    "source_count": 0,
    "sources": [],
    "finish_reason": "STOP",
    "response_preview": "{ \"events\": [ ... ]"
  }
}
```

The UI does not currently render `provider_debug` directly, but the API includes it in collection responses.

## 10. Endpoints the UI Currently Uses

Used directly today:

- `GET /api/v1/config`
- `POST /api/v1/runtime/model`
- `POST /api/v1/events/live/discover`
- `POST /api/v1/events/live/state`
- `GET /api/v1/events/upcoming`

Available but not currently used by the UI:

- `GET /api/v1/health`
- `GET /api/v1/events/live`
- `GET /api/v1/events/live/:matchId`
- `GET /api/v1/events/live/:matchId/context`
- `GET /api/v1/events/live/:matchId/state`
- `GET /api/v1/events/upcoming/:matchId`
- `GET /api/v1/openapi.json`
