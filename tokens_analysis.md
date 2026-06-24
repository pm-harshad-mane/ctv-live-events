# Token Analysis

This document estimates token usage for the AI-backed API calls in this repo.

The goal is planning and cost modeling, especially for:

- live discovery
- live state refresh
- upcoming match retrieval

Official OpenAI pricing reference:

- `https://openai.com/api/pricing/`

## Scope

Analyzed API flows:

- `POST /api/v1/events/live/discover`
- `POST /api/v1/events/live/state`
- `GET /api/v1/events/upcoming`
- single-match lookup helpers that exist in the backend:
  - live lookup
  - live context lookup
  - live state lookup
  - upcoming lookup

Saved AI logs can now also be grouped by UI/request source via
`request.request_origin` in each log entry:

- `live_page`
- `tracker`
- `upcoming_page`
- `unknown`

That matters for cost analysis because the same backend schema can be used by
multiple UI surfaces. For example:

- the `Live` page periodic refresh uses `live_state_refresh_response` with
  `request_origin = "live_page"`
- the single-match tracker uses `live_state_refresh_response` with
  `request_origin = "tracker"`

When analyzing real cost from saved logs, do not group only by `schema_name`.
Group by:

- `provider`
- `schema_name`
- `request.request_origin`
- `phase`

## Important Note

These are **estimates**, not exact billed token counts.

I did **not** use a model-specific tokenizer here. Instead, I measured the actual strings produced by the current prompt builders and schemas, then used this rough estimator:

```text
estimated_tokens = ceil(characters / 4)
```

This is good enough for planning and relative comparison, but real billed usage will vary by:

- provider
- model
- tokenizer
- exact match count
- exact response verbosity

## Method

The estimates are based on the current code:

- prompt builders in [src/server/openai/prompts.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/server/openai/prompts.ts)
- structured schemas in [src/server/openai/schemas.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/server/openai/schemas.ts)
- representative outputs from mock providers in:
  - [src/server/providers/mock/mockProviders.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/server/providers/mock/mockProviders.ts)
  - [src/server/providers/mock/mockData.ts](/Users/harshadmane/Desktop/GitHub/ctv-live-events/src/server/providers/mock/mockData.ts)

For collection endpoints, I measured both:

- a 1-match case
- a larger multi-match case

## Using Saved Logs

When working from real saved AI logs in
[logs/ai-responses](/Users/harshadmane/Desktop/GitHub/ctv-live-events/logs/ai-responses),
use these fields together:

- `provider`
- `schema_name`
- `request.request_origin`
- `phase`
- `model`

Recommended grouping examples:

- `openai + live_state_refresh_response + tracker`
- `openai + live_state_refresh_response + live_page`
- `gemini + upcoming_events_response + upcoming_page`

This makes it possible to measure:

- tracker-specific cost separately from the general live page
- upcoming-page cost separately from live discovery/state refresh
- provider/model differences for the same UI surface

## Key Finding

The **schema itself is a major part of input size** for the AI calls.

Especially for live endpoints, the input token cost is heavily dominated by:

- instructions
- strict JSON schema

That means:

- discovery input cost is mostly fixed
- state refresh input cost is mostly fixed, with a smaller per-game increment
- output cost grows much more directly with number of matches returned

## Estimated Token Usage

### Summary Table

| Flow | Estimated input tokens | Estimated output tokens | Notes |
|---|---:|---:|---|
| Live discover, 1 match | 3544 | 1312 | Full live event with context + live state |
| Live discover, 11 matches | 3570 | 14526 | Input barely grows; output grows sharply |
| Live state refresh, 1 game | 3139 | 1000 | Most relevant cost for periodic updates |
| Live state refresh, 3 games | 3401 | 2997 | Good basis for per-game scaling |
| Upcoming collection, 1 match | 956 | 402 | Much cheaper than live flows |
| Upcoming collection, 11 matches | 982 | 4416 | Input almost fixed; output scales with matches |
| Live lookup, single match | 3423 | 1308 | Similar to live discovery |
| Live context lookup, single match | 657 | 247 | Cheapest live lookup variant |
| Live state lookup, single match | 2812 | 992 | Smaller than full live lookup |
| Upcoming lookup, single match | 879 | 398 | Similar to upcoming collection with 1 result |

## England vs Ghana Case Study

This section uses the real saved AI logs for the `England vs Ghana` World Cup
match on `2026-06-23`.

Source set:

- provider: `gemini`
- match variants seen in log folders:
  - `england_ghana_20260623`
  - `fwc2026_eng_gha`
  - `wc_2026_group_l_england_ghana`
  - `world_cup_2026_eng_gha`

Method:

- same rough token estimator used elsewhere in this document:
  - `estimated_tokens = ceil(characters / 4)`
- input estimate includes:
  - request instructions
  - serialized request input
  - serialized tools list
  - max output token setting when present
- output estimate in this case study is based on the saved
  `structured_output` field
- parse-error logs are counted separately because they often have no usable
  structured output

### Log Volume

Saved England/Ghana AI logs found:

- total logs: `96`
- provider split:
  - `gemini`: `96`

Schema / phase split:

| Schema | Success | Parse error | Total |
|---|---:|---:|---:|
| `live_discovery_response` | 12 | 5 | 17 |
| `live_state_refresh_response` | 55 | 24 | 79 |

### Per-Call Averages From Real Logs

| Flow | Count | Avg input tokens | Avg structured-output tokens |
|---|---:|---:|---:|
| Live discovery success | 12 | 1303 | 1801 |
| Live discovery parse error | 5 | 1324 | ~0 |
| Live state refresh success | 55 | 1361 | 1573 |
| Live state refresh parse error | 24 | 1392 | ~0 |

### Request-Origin Breakdown

This same match generated logs from both the general live page and the
single-match tracker.

| Request origin | Flow | Success | Parse error | Avg input tokens | Avg structured-output tokens |
|---|---|---:|---:|---:|---:|
| `live_page` | `live_discovery_response` | 8 | 5 | 1324 | 1833 on success |
| `live_page` | `live_state_refresh_response` | 21 | 15 | 1439 | 1578 on success |
| `tracker` | `live_discovery_response` | 3 | 0 | 1261 | 1771 on success |
| `tracker` | `live_state_refresh_response` | 34 | 9 | 1312 on success / 1313 on parse error | 1570 on success |

### Tracker-Specific Totals

For the tracker-origin requests for this single match:

- successful discovery calls:
  - count: `3`
  - total estimated input tokens: `3783`
  - total estimated structured-output tokens: `5314`
- successful state refresh calls:
  - count: `34`
  - total estimated input tokens: `44623`
  - total estimated structured-output tokens: `53388`
- failed state refresh parse-error calls:
  - count: `9`
  - total estimated input tokens still spent: `11815`

Practical tracker total for this match:

- successful tracker calls only:
  - input: `48406`
  - structured output: `58702`
- including parse-error tracker attempts:
  - input: `60221`
  - structured output still usable: `58702`

### What This Means

Key observations from this real match sample:

- `live_state_refresh_response` dominated the cost footprint
  - `79` total state refresh logs vs `17` discovery logs
- tracker usage is materially cheaper per call than the general live page for
  state refresh
  - tracker refresh input average: `~1312`
  - live-page refresh input average: `~1439`
- parse errors matter financially
  - the England/Ghana tracker burned an estimated `11815` input tokens on
    failed tracker refresh attempts alone
- structured output for a single tracked match is not small
  - successful tracker refreshes averaged `~1570` output tokens
- the real-match data is directionally close to the earlier generic estimates
  - generic single-game live refresh estimate:
    - input: `3139`
    - output: `1000`
  - real England/Ghana Gemini sample:
    - input: `~1361`
    - output: `~1573`

The difference is expected because the earlier generic estimate assumed a much
more conservative output shape, while the real Gemini responses for this match
were verbose in:

- summaries
- active players
- recent events
- reason codes
- prediction blocks

### Takeaway For Cost Planning

For live tracked matches, the main cost driver is not rediscovery. It is the
repeated single-match `live/state` refresh loop.

For this actual England/Ghana tracker run:

- every successful tracker refresh cost about:
  - `~1312` estimated input tokens
  - `~1570` estimated structured-output tokens
- failed parse-error refreshes still consumed roughly:
  - `~1313` estimated input tokens each

So any production cost model for tracked live matches should include:

- cadence
- average match duration
- retry / parse-error rate
- provider-specific verbosity

### Estimated Dollar Cost For This Exact Tracker Run

Using the same pricing assumptions already listed in the OpenAI costing section:

- `gpt-5.4-mini`
  - input: `$0.75 / 1M tokens`
  - output: `$4.50 / 1M tokens`
- `gpt-5.4`
  - input: `$2.50 / 1M tokens`
  - output: `$15.00 / 1M tokens`
- web search:
  - `$0.01` per call

Important note:

- the saved England/Ghana logs were Gemini-backed
- the dollar figures below are therefore best read as
  **OpenAI-equivalent cost if the same request volume and payload sizes were
  sent through OpenAI pricing assumptions**

#### Successful Tracker Calls Only

From the England/Ghana tracker sample:

- successful tracker discovery calls: `3`
- successful tracker state refresh calls: `34`
- total successful tracker calls: `37`
- total successful tracker input tokens: `48406`
- total successful tracker structured-output tokens: `58702`

Estimated cost:

| Model | Input cost | Output cost | Web-search cost | Total |
|---|---:|---:|---:|---:|
| `gpt-5.4-mini` | `$0.036305` | `$0.264159` | `$0.370000` | `$0.670464` |
| `gpt-5.4` | `$0.121015` | `$0.880530` | `$0.370000` | `$1.371545` |

#### Including Failed Tracker Parse-Error Attempts

From the same sample:

- failed tracker state refresh parse errors: `9`
- total tracker calls including failed attempts: `46`
- total tracker input tokens including failed attempts: `60221`
- successful structured-output tokens remained: `58702`

Estimated cost:

| Model | Input cost | Output cost | Web-search cost | Total |
|---|---:|---:|---:|---:|
| `gpt-5.4-mini` | `$0.045166` | `$0.264159` | `$0.460000` | `$0.769325` |
| `gpt-5.4` | `$0.150553` | `$0.880530` | `$0.460000` | `$1.491083` |

#### Practical Reading

This specific match sample shows three useful cost realities:

- web-search calls are a very large share of total cost
  - on `gpt-5.4-mini`, successful tracker calls spent about:
    - `$0.370000` on search
    - `$0.300464` on model tokens
- parse-error retries materially increase total cost even when they produce no
  usable structured output
  - in this sample, the failed tracker attempts increased estimated total cost
    by about:
    - `+$0.098861` on `gpt-5.4-mini`
    - `+$0.119538` on `gpt-5.4`
- the exact tracker cadence and provider reliability matter more than one
  single response size
  - repeated refreshes dominate the spend profile for live tracking

## Detailed Findings

### 1. Live Discovery

Representative measurements:

- 1 returned match:
  - input: `3544`
  - output: `1312`
- 11 returned matches:
  - input: `3570`
  - output: `14526`

Interpretation:

- input is almost fixed
- output scales almost linearly with number of returned matches

Approximate output growth:

```text
~1321 output tokens per returned live match
```

Why this is expensive:

- every live event includes:
  - full match context
  - participants
  - pre-match intelligence
  - full live state
  - active players
  - predictions
  - freshness + verification

### 2. Live State Refresh

Representative measurements:

- 1 game:
  - input: `3139`
  - output: `1000`
- 3 games:
  - input: `3401`
  - output: `2997`

Estimated per-game scaling:

Input growth from 1 to 3 games:

```text
(3401 - 3139) / 2 = ~131 input tokens per additional game
```

Output growth from 1 to 3 games:

```text
(2997 - 1000) / 2 = ~999 output tokens per additional game
```

Practical approximation:

```text
live_state_refresh_input_tokens ≈ 3008 + (131 × number_of_games)
live_state_refresh_output_tokens ≈ 1 + (999 × number_of_games)
```

This is the most useful formula for cost planning because `live/state` is the endpoint that can run repeatedly while games are in progress.

### 3. Upcoming Collection

Representative measurements:

- 1 match:
  - input: `956`
  - output: `402`
- 11 matches:
  - input: `982`
  - output: `4416`

Interpretation:

- much cheaper than live discovery
- input is almost fixed
- output scales with result count, but less aggressively than live discovery

Approximate output growth:

```text
~401 output tokens per returned upcoming match
```

### 4. Single-Match Lookup Endpoints

These are currently available in the backend, but the UI does not currently use them for `More Details`.

#### Live lookup

- input: `3423`
- output: `1308`

#### Live context lookup

- input: `657`
- output: `247`

#### Live state lookup

- input: `2812`
- output: `992`

#### Upcoming lookup

- input: `879`
- output: `398`

## Input Size Drivers

### Large fixed cost

The following are the main fixed contributors:

- prompt instructions
- strict JSON schema

Measured schema sizes in characters:

- live discovery schema: `11667`
- live state refresh schema: `9487`
- live lookup schema: `11603`
- live context lookup schema: `1793`
- live state lookup schema: `9189`
- upcoming schema: `2769`
- upcoming lookup schema: `2705`

This is why live calls stay expensive even when there is only one match.

### Variable cost

The main variable contributors are:

- number of matches in the response
- number of participants
- number of active players
- length of summaries / key points / recent events

## Cost Planning Guidance

### Best endpoint for repeated polling

For live polling, `POST /api/v1/events/live/state` is the right endpoint to optimize around.

Why:

- it avoids repeating full match context
- per-game input growth is relatively small
- output still scales, but far less wastefully than full rediscovery

### Worst-case expensive endpoint

`POST /api/v1/events/live/discover` is the most expensive collection call.

Reason:

- full context
- full dynamic state
- large response per match

### Cheapest useful AI call

`GET /api/v1/events/upcoming` is the cheapest collection call in the current design.

## OpenAI Costing

This section converts the token estimates above into rough OpenAI API cost estimates using current standard pricing.

### Recommended Models

For this product, the two OpenAI models that look most practical are:

1. `gpt-5.4-mini`
   - best default candidate for production
   - much cheaper on both input and output
   - still supports the tool stack this app needs, including web search
2. `gpt-5.4`
   - higher-cost option when quality is more important than price
   - useful as a premium or fallback mode for harder live-discovery cases

Why these two:

- this app is mostly doing:
  - structured extraction
  - grounded web retrieval
  - concise synthesis into strict JSON
- that makes `gpt-5.4-mini` the strongest cost/performance default
- `gpt-5.4` is the higher-quality step-up without jumping to the most expensive flagship tier

### Why These Models Fit This App

This app is not a generic chatbot. Its AI calls have a very specific shape:

- large fixed instructions
- large strict JSON schemas
- web-grounded retrieval
- mostly short-to-medium factual synthesis
- repeated live refreshes where cost can compound quickly

That changes which models make sense.

#### Why `gpt-5.4-mini` is the best default

`gpt-5.4-mini` is the best default for this product because:

- it supports the exact tool stack we need:
  - Responses API
  - structured outputs
  - web search
- this workload is more about:
  - reliable extraction
  - schema compliance
  - concise summaries
  than about long-form reasoning
- many requests are recurring:
  - live discovery
  - periodic live state refresh
  - upcoming refreshes
- those recurring requests make output-token cost matter a lot
- `gpt-5.4-mini` keeps that recurring cost much lower while still staying in the modern GPT-5.4 family

In short:

- the app needs a model that is good enough at grounded structured generation
- but cheap enough to tolerate repeated refresh traffic
- `gpt-5.4-mini` fits that balance best

#### Why `gpt-5.4` is the right higher-quality option

`gpt-5.4` is the most sensible step-up because:

- it has the same tool compatibility surface we need
- it is positioned as the more capable professional-work model in the same family
- it is expensive, but still far below the flagship pricing tier
- it is a better fit for cases where quality matters more than cost, such as:
  - ambiguous live discovery
  - harder multi-match disambiguation
  - premium mode
  - fallback when the cheaper model returns weak or sparse results

In short:

- if `gpt-5.4-mini` is the default operating model
- `gpt-5.4` is the quality upgrade path that does not completely break the cost envelope

#### Why not use a larger flagship model by default

Using a larger flagship model by default is hard to justify for this app because:

- many requests repeat over time
- the product returns structured sports data, not long nuanced prose
- strict schema + web grounding already constrain the task heavily
- the marginal quality gain may not justify the much higher recurring spend

This is especially true for:

- `live/state` refreshes
- smaller upcoming lookups
- repeated day-to-day traffic

#### Why not use a cheaper nano-class model as the main default

A nano-class model may be attractive on raw cost, but it is riskier for this app because:

- schema-heavy responses are large and detailed
- live sports state requires richer structured reasoning than simple classification
- grounded retrieval plus synthesis plus normalization is more demanding than a lightweight extraction task
- output quality degradation would likely show up directly in:
  - bad summaries
  - weaker match intelligence
  - missing or malformed structured fields

So nano-class models may be worth future experimentation, but they are not the safest primary recommendation for the current product shape.

### Pricing Assumptions

Using current standard pricing:

- `gpt-5.4-mini`
  - input: `$0.75 / 1M tokens`
  - output: `$4.50 / 1M tokens`
- `gpt-5.4`
  - input: `$2.50 / 1M tokens`
  - output: `$15.00 / 1M tokens`
- web search
  - `$10.00 / 1K calls`
  - effectively `$0.01` per tool call
  - search content tokens are free

### Important Assumptions

- The tables below assume `1` web-search tool call per AI request.
- In the current implementation, that is the normal case for:
  - live discovery
  - live state refresh
  - upcoming retrieval
  - single-match lookups
- If we later batch or retry requests, multiply the web-search call cost accordingly.
- These numbers are **base request costs**. They do not include:
  - retries
  - failed requests
  - duplicated refreshes
  - any future batching fan-out

### Base Cost Per Request

| Flow | Estimated input tokens | Estimated output tokens | Web-search calls assumed | `gpt-5.4-mini` estimated cost | `gpt-5.4` estimated cost |
|---|---:|---:|---:|---:|---:|
| Live discover, 1 match | 3544 | 1312 | 1 | `$0.018562` | `$0.038540` |
| Live discover, 11 matches | 3570 | 14526 | 1 | `$0.078045` | `$0.236815` |
| Live state refresh, 1 game | 3139 | 1000 | 1 | `$0.016854` | `$0.032848` |
| Live state refresh, 3 games | 3401 | 2997 | 1 | `$0.026037` | `$0.063458` |
| Upcoming collection, 1 match | 956 | 402 | 1 | `$0.012526` | `$0.018420` |
| Upcoming collection, 11 matches | 982 | 4416 | 1 | `$0.030609` | `$0.078695` |
| Live lookup, single match | 3423 | 1308 | 1 | `$0.018453` | `$0.038177` |
| Live context lookup, single match | 657 | 247 | 1 | `$0.011604` | `$0.015348` |
| Live state lookup, single match | 2812 | 992 | 1 | `$0.016573` | `$0.031910` |
| Upcoming lookup, single match | 879 | 398 | 1 | `$0.012450` | `$0.018168` |

### What This Means In Practice

#### Live discovery is the most expensive request

Even on `gpt-5.4-mini`, a large live discovery response is already around:

```text
$0.078045 per request
```

On `gpt-5.4`, the same large result set is about:

```text
$0.236815 per request
```

That is why full rediscovery frequency matters much more than detail lookups.

#### Web-search cost is a large fixed component on smaller calls

For small requests, the fixed `$0.01` search charge dominates.

Example:

- upcoming lookup on `gpt-5.4-mini`
  - total estimated cost: `$0.012450`
  - web-search portion alone: `$0.010000`

So for small calls, most of the cost is the search tool call, not the model tokens.

#### State refresh is where per-game scaling matters

Based on the earlier token scaling:

- additional input per live game: `~131 tokens`
- additional output per live game: `~999 tokens`

Estimated **extra per additional live game** during a `live/state` refresh:

| Model | Extra input cost per game | Extra output cost per game | Extra total per game |
|---|---:|---:|---:|
| `gpt-5.4-mini` | `$0.000098` | `$0.004496` | `$0.004594` |
| `gpt-5.4` | `$0.000328` | `$0.014985` | `$0.015313` |

Important:

- that extra-per-game cost does **not** include another search fee
- the `$0.01` web-search cost is per request, not per game, assuming the refresh stays batched into one AI call

### Recommendation

If we optimize for cost while keeping quality reasonable:

- default to `gpt-5.4-mini`
- reserve `gpt-5.4` for:
  - premium mode
  - low-confidence fallback
  - selected hard live-discovery cases

Reason:

- `gpt-5.4` is about `2.8x` more expensive on input and `3.3x` more expensive on output than `gpt-5.4-mini`
- for this app, output tokens dominate many requests
- that makes `gpt-5.4-mini` the much safer baseline for recurring live traffic

## Example Planning Scenarios

### Scenario A: 1 live game on screen

One manual discovery:

- input: `~3544`
- output: `~1312`

Then one state refresh:

- input: `~3139`
- output: `~1000`

### Scenario B: 5 live games on screen

Approximate state refresh cost using the fitted formula:

```text
input ≈ 3008 + (131 × 5) = 3663
output ≈ 1 + (999 × 5) = 4996
```

### Scenario C: 10 upcoming matches returned

## Example: One Live FIFA Match

This is a concrete example for a single live soccer match, such as a FIFA World Cup match, where we want fresh information every 5 minutes throughout the match.

### Assumptions

- sport: soccer / FIFA-style match
- 1 live match on screen
- 1 initial `live/discover` call to establish match context
- then repeated `live/state` refreshes for that same match
- refresh cadence: every `5` minutes
- base example uses a `90` minute match window
- no retries
- no extra fallback calls
- `1` web-search call per AI request

### 90-Minute Match Cost

A 90-minute match at 5-minute intervals means:

- `1` initial discovery call
- `18` state refresh calls

Formula:

```text
total_cost = live_discover_1_match + (18 × live_state_refresh_1_game)
```

| Model | Initial discovery | 18 state refreshes | Total estimated cost for one live FIFA match |
|---|---:|---:|---:|
| `gpt-5.4-mini` | `$0.018562` | `$0.303372` | `$0.321934` |
| `gpt-5.4` | `$0.038540` | `$0.591264` | `$0.629804` |

### If You Want To Include Full Real-World Match Coverage

If we instead budget for a longer real-world coverage window of about `110` minutes to include halftime and stoppage time, then:

- `1` initial discovery call
- `22` state refresh calls

Formula:

```text
total_cost = live_discover_1_match + (22 × live_state_refresh_1_game)
```

| Model | Initial discovery | 22 state refreshes | Total estimated cost for one fully covered live FIFA match |
|---|---:|---:|---:|
| `gpt-5.4-mini` | `$0.018562` | `$0.370788` | `$0.389350` |
| `gpt-5.4` | `$0.038540` | `$0.722656` | `$0.761196` |

### Practical Takeaway

For this kind of soccer use case:

- `gpt-5.4-mini` is much more workable for repeated live updates
- `gpt-5.4` roughly doubles the per-match cost envelope

That matters because live sports cost scales with:

- number of concurrent matches
- refresh frequency
- number of active users watching those matches

So if the product’s normal mode is “keep one live soccer match fresh every 5 minutes,” `gpt-5.4-mini` is the safer default pricing baseline.
Approximate upcoming collection:

```text
input ≈ ~980
output ≈ ~4010
```

## Gemini Costing

This section adds the same style of costing for the Gemini model that this repo
actually uses under the `Gemini 3` label.

Current repo model:

- `GEMINI_MODEL=gemini-3.5-flash`

### Gemini Pricing Assumptions

Using Google's official Gemini pricing for `gemini-3.5-flash`:

- input: `$1.50 / 1M tokens`
- output (including thinking tokens): `$9.00 / 1M tokens`
- Google Search grounding:
  - `5,000` prompts per month free across Gemini 3 models
  - then `$14 / 1,000` search queries

Important note:

- one Gemini request can result in one or more Google Search queries
- Google charges per individual search query performed

### England vs Ghana: Exact Gemini Tracker-Run Cost

This uses the actual saved England vs Ghana tracker-origin Gemini logs already
summarized earlier in this document.

Successful tracker calls only:

- successful tracker discovery calls: `3`
- successful tracker state refresh calls: `34`
- total successful tracker calls: `37`
- total successful tracker input tokens: `48406`
- total successful tracker structured-output tokens: `58702`

Estimated Gemini cost:

| Component | Cost |
|---|---:|
| Input tokens | `$0.072609` |
| Output tokens | `$0.528318` |
| Google Search grounding | `$0.518000` |
| Total | `$1.118927` |

Including failed tracker parse-error attempts:

- failed tracker state refresh parse errors: `9`
- total tracker calls including failed attempts: `46`
- total tracker input tokens including failed attempts: `60221`
- successful structured-output tokens remained: `58702`

Estimated Gemini cost:

| Component | Cost |
|---|---:|
| Input tokens | `$0.090332` |
| Output tokens | `$0.528318` |
| Google Search grounding | `$0.644000` |
| Total | `$1.262650` |

### Practical Gemini Takeaway

For this exact England vs Ghana sample:

- search grounding was a very large share of total spend
- parse-error retries increased cost noticeably
- repeated single-match `live/state` refreshes dominated the overall tracker
  spend profile

Compared with the OpenAI-equivalent numbers earlier in this document:

- `gemini-3.5-flash` is materially more expensive than the
  `gpt-5.4-mini` baseline used there
- Gemini search grounding is also more expensive in these current assumptions

So if Gemini remains the tracking provider, cost control depends heavily on:

- reducing parse errors
- avoiding unnecessary retries
- using a sensible refresh cadence
- keeping grounded-search request count under control

## Short Summary: England vs Ghana

The saved `England vs Ghana` tracker sample gives a useful real-world estimate
for one live match, but it was **not completely covered from kickoff to final
whistle by the tracker**.

Coverage detail:

- kickoff: `2026-06-23T20:00:00Z` (`1:00 PM PDT`)
- last real captured tracker point: `2026-06-23T20:54:16Z`
- captured match state at that point: `Halftime`, `0-0`

So the tracker recorded roughly the **first 54 minutes of real elapsed time**
around the match, which corresponds to coverage through the end of the first
half and halftime only. It did **not** continuously capture the second half.

In practical terms:

- captured portion: about **54 of ~120 real-world match minutes** if you
  include halftime and stoppage as part of a normal broadcast/event window
- or about **54 of ~90 regulation minutes** if you compare only against the
  nominal regulation clock

The laptop/session interruption meant the stored history stopped at halftime,
and the final `0-0` result was appended later as a terminal snapshot rather
than captured through continuous second-half polling.

Even with that limitation, the saved Gemini tracker logs show:

- successful tracker calls: `37`
- failed tracker parse-error attempts: `9`
- successful tracker input tokens: `48406`
- successful tracker structured-output tokens: `58702`
- total tracker input tokens including failed attempts: `60221`

Estimated cost for this partial tracker run:

- `gemini-3.5-flash`
  - successful calls only: `$1.118927`
  - including failed attempts: `$1.262650`
- OpenAI-equivalent comparison
  - `gpt-5.4-mini`: `$0.670464` successful-only, `$0.769325` including failed attempts
  - `gpt-5.4`: `$1.371545` successful-only, `$1.491083` including failed attempts

So the England/Ghana numbers are best treated as a **partial real-match cost
sample covering only the first half / halftime window**, not as the cost of a
fully captured end-to-end live match.

## Practical Recommendations

1. Keep live discovery infrequent.
   It is the heaviest live endpoint.

2. Favor `live/state` for periodic refresh.
   It scales much better per game.

3. Limit the number of simultaneously tracked live games.
   Output tokens rise roughly linearly with number of games.

4. Be careful with verbose generated fields.
   Long summaries, large active-player sections, and many recent events can materially increase output cost.

5. If cost becomes a problem, the biggest wins are:
   - reduce response verbosity for live state
   - shrink schema shape for refresh calls
   - cap active players and recent events
   - batch fewer matches per refresh request

## Current UI-Relevant AI Calls

The current UI mainly relies on:

- `GET /api/v1/config`  
  Not AI-priced.
- `POST /api/v1/runtime/model`  
  Not AI-priced directly.
- `POST /api/v1/events/live/discover`
- `POST /api/v1/events/live/state`
- `GET /api/v1/events/upcoming`

So for actual user-facing cost analysis, the most important endpoints are:

1. `live/discover`
2. `live/state`
3. `upcoming`

## Final Takeaway

If we simplify the current system into cost drivers:

- **Live discovery** = high fixed input cost + very high per-match output cost
- **Live state refresh** = medium-high fixed input cost + roughly `~1000` output tokens per live game
- **Upcoming collection** = low fixed input cost + roughly `~400` output tokens per returned upcoming match

That means the most useful number to remember for planning is:

```text
live state refresh ≈ 131 input tokens + 999 output tokens per additional live game
```

on top of a large fixed request baseline.
