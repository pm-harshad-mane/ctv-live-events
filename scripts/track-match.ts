import http from "node:http";
import https from "node:https";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LiveEvent, MatchIdentity, TrackerHistoryPoint } from "../src/shared/schemas/live";

type ProviderMode = "mock" | "openai" | "gemini";

type DiscoverEnvelope = {
  data: {
    events: LiveEvent[];
  };
  warnings: string[];
};

type StateRefreshEnvelope = {
  data: {
    states: Array<LiveEvent["live_state"] & { match_id: string }>;
    failed_matches: Array<{
      match_id: string;
      code: string;
      message: string;
    }>;
  };
  warnings: string[];
};

type TrackerArchiveEnvelope = {
  data: {
    archive: unknown;
  };
  warnings: string[];
};

type TrackerSession = {
  matchLabel: string;
  provider: ProviderMode;
  region: string;
  sport: string;
  cadenceSeconds: number;
  kickoffIso: string;
  trackedEvent: LiveEvent | null;
  history: TrackerHistoryPoint[];
  startedAt: string;
  updatedAt: string;
  consecutiveMisses: number;
  archived: boolean;
};

const DEFAULT_BASE_URL = "http://localhost:8787";
const DEFAULT_REGION = "north-america";
const DEFAULT_SPORT = "soccer";
const DEFAULT_PROVIDER: ProviderMode = "gemini";
const DEFAULT_CADENCE_SECONDS = 180;
const MAX_CONSECUTIVE_MISSES_AFTER_TRACKING = 3;
const TERMINAL_MATCH_STATUSES = new Set(["completed", "cancelled", "postponed"]);

const sanitizePathToken = (value: string): string =>
  value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
  "unknown";

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const normalizeName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const MATCH_SIDE_SEPARATOR_PATTERN =
  /\s+(?:vs?\.?|versus|at)\s+|\s+[-–—]\s+|\s+@\s+/i;

const splitMatchSides = (value: string): string[] =>
  value
    .split(MATCH_SIDE_SEPARATOR_PATTERN)
    .map((part) => normalizeName(part))
    .filter(Boolean);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, "true");
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const match = values.get("match");
  const kickoff = values.get("kickoff");
  if (!match || !kickoff) {
    throw new Error(
      "Usage: tsx scripts/track-match.ts --match \"England vs Ghana\" --kickoff \"2026-06-23T13:00:00-07:00\" [--provider gemini] [--cadence-seconds 180] [--base-url http://localhost:8787]"
    );
  }

  return {
    match,
    kickoff,
    provider: (values.get("provider") as ProviderMode | undefined) ?? DEFAULT_PROVIDER,
    region: values.get("region") ?? DEFAULT_REGION,
    sport: values.get("sport") ?? DEFAULT_SPORT,
    baseUrl: values.get("base-url") ?? DEFAULT_BASE_URL,
    cadenceSeconds: Number(values.get("cadence-seconds") ?? DEFAULT_CADENCE_SECONDS)
  };
};

const requestJson = async <T>(
  url: string,
  init?: RequestInit
): Promise<T> => {
  const parsedUrl = new URL(url);
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body
        ? String(init.body)
        : undefined;

  return new Promise<T>((resolvePromise, rejectPromise) => {
    const requestImpl = parsedUrl.protocol === "https:" ? https : http;
    const request = requestImpl.request(
      {
        method: init?.method ?? "GET",
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          "Content-Type": "application/json",
          ...(body
            ? {
                "Content-Length": Buffer.byteLength(body)
              }
            : {}),
          ...(init?.headers ?? {})
        }
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          let payload: unknown = null;
          try {
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            rejectPromise(
              new Error(
                `Local API returned non-JSON response: ${raw.slice(0, 280)}`
              )
            );
            return;
          }
          if ((response.statusCode ?? 500) >= 400) {
            rejectPromise(
              new Error(
                (payload &&
                typeof payload === "object" &&
                "error" in payload &&
                payload.error &&
                typeof payload.error === "object" &&
                "message" in payload.error &&
                typeof payload.error.message === "string"
                  ? payload.error.message
                  : null) ??
                  `Request failed with status ${response.statusCode ?? 500}.`
              )
            );
            return;
          }
          resolvePromise(payload as T);
        });
      }
    );

    request.on("error", rejectPromise);
    if (body) {
      request.write(body);
    }
    request.end();
  });
};

const buildIdentity = (event: LiveEvent): MatchIdentity => ({
  match_id: event.match_id,
  sport: event.context?.match.sport ?? DEFAULT_SPORT,
  tournament_name: event.context?.match.tournament_name ?? "Unknown",
  scheduled_start_time:
    event.context?.match.scheduled_start_time ?? new Date().toISOString(),
  participants:
    event.context?.participants.map((participant) => ({
      participant_id: participant.participant_id,
      name: participant.name,
      short_name: participant.short_name
    })) ?? []
});

const matchMatchesTarget = (event: LiveEvent, targetMatch: string): boolean => {
  const target = normalizeName(targetMatch);
  const matchName = normalizeName(event.context?.match.match_name ?? "");
  if (matchName === target) {
    return true;
  }

  const targetSides = splitMatchSides(targetMatch).sort();
  const eventSides = splitMatchSides(event.context?.match.match_name ?? "").sort();

  return (
    targetSides.length === 2 &&
    eventSides.length === 2 &&
    targetSides[0] === eventSides[0] &&
    targetSides[1] === eventSides[1]
  );
};

const getSessionFilePath = (kickoffIso: string, match: string): string => {
  const day = kickoffIso.slice(0, 10);
  const slug = sanitizePathToken(match);
  return resolve(
    process.cwd(),
    "logs",
    "match-tracker-sessions",
    day,
    slug,
    "session.json"
  );
};

const writeSession = async (filePath: string, session: TrackerSession) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(`${filePath}`, `${JSON.stringify(session, null, 2)}\n`, "utf8");
};

const loadSession = async (filePath: string): Promise<TrackerSession | null> => {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(await readFile(filePath, "utf8")) as TrackerSession;
};

const appendHistory = (
  history: TrackerHistoryPoint[],
  nextState: LiveEvent["live_state"]
): TrackerHistoryPoint[] => {
  const capturedAt = nextState.freshness.generated_at;
  if (history.at(-1)?.capturedAt === capturedAt) {
    return history;
  }

  return [...history, { capturedAt, liveState: nextState }];
};

const createTerminalSnapshot = (event: LiveEvent): LiveEvent => ({
  ...event,
  live_state: {
    ...event.live_state,
    match_status: "completed",
    special_state: {
      ...event.live_state.special_state,
      status_reason:
        event.live_state.special_state.status_reason ??
        "Tracking inferred match completion after repeated live misses."
    }
  }
});

const switchProvider = async (baseUrl: string, provider: ProviderMode) => {
  await requestJson(`${baseUrl}/api/v1/runtime/model`, {
    method: "POST",
    body: JSON.stringify({ model: provider })
  });
};

const discoverMatch = async (
  baseUrl: string,
  region: string,
  sport: string,
  targetMatch: string
): Promise<{ event: LiveEvent | null; warnings: string[] }> => {
  const payload = await requestJson<DiscoverEnvelope>(
    `${baseUrl}/api/v1/events/live/discover`,
    {
      method: "POST",
      body: JSON.stringify({
        region,
        sport,
        include_context: true,
        request_origin: "tracker",
        known_matches: []
      })
    }
  );

  const event =
    payload.data.events.find((candidate) =>
      matchMatchesTarget(candidate, targetMatch)
    ) ?? null;

  return { event, warnings: payload.warnings };
};

const refreshMatchState = async (
  baseUrl: string,
  region: string,
  sport: string,
  event: LiveEvent
): Promise<LiveEvent["live_state"] | null> => {
  let payload: StateRefreshEnvelope;
  try {
    payload = await requestJson<StateRefreshEnvelope>(
      `${baseUrl}/api/v1/events/live/state`,
      {
        method: "POST",
        body: JSON.stringify({
          region,
          sport,
          request_origin: "tracker",
          matches: [buildIdentity(event)]
        })
      }
    );
  } catch (error) {
    console.warn(
      `[tracker] state refresh request failed for ${event.match_id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }

  const failed = payload.data.failed_matches.find(
    (candidate) => candidate.match_id === event.match_id
  );
  if (failed) {
    console.warn(`[tracker] state refresh failed for ${event.match_id}: ${failed.message}`);
    return null;
  }

  return (
    payload.data.states.find((candidate) => candidate.match_id === event.match_id) ??
    null
  );
};

const archiveSession = async (
  baseUrl: string,
  event: LiveEvent,
  history: TrackerHistoryPoint[]
) => {
  await requestJson<TrackerArchiveEnvelope>(`${baseUrl}/api/v1/tracker/archives`, {
    method: "POST",
    body: JSON.stringify({
      event,
      history
    })
  });
};

const main = async () => {
  const options = parseArgs();
  const kickoffTime = new Date(options.kickoff);
  if (Number.isNaN(kickoffTime.getTime())) {
    throw new Error("Invalid kickoff timestamp.");
  }

  const sessionFilePath = getSessionFilePath(options.kickoff, options.match);
  const session =
    (await loadSession(sessionFilePath)) ??
    ({
      matchLabel: options.match,
      provider: options.provider,
      region: options.region,
      sport: options.sport,
      cadenceSeconds: options.cadenceSeconds,
      kickoffIso: options.kickoff,
      trackedEvent: null,
      history: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      consecutiveMisses: 0,
      archived: false
    } satisfies TrackerSession);

  console.log(
    `[tracker] Starting backend tracking for ${options.match} using ${options.provider}. Kickoff ${options.kickoff}. Cadence ${options.cadenceSeconds}s.`
  );

  await switchProvider(options.baseUrl, options.provider);
  console.log(`[tracker] Active provider switched to ${options.provider}.`);

  for (;;) {
    const nowIso = new Date().toISOString();
    console.log(`[tracker] Poll at ${nowIso}`);

    const { event, warnings } = await discoverMatch(
      options.baseUrl,
      options.region,
      options.sport,
      options.match
    );

    if (warnings.length > 0) {
      console.log(`[tracker] Discovery warnings: ${warnings.join(" | ")}`);
    }

    if (!event) {
      session.consecutiveMisses += 1;
      session.updatedAt = nowIso;
      await writeSession(sessionFilePath, session);

      if (
        session.trackedEvent &&
        session.history.length > 0 &&
        session.consecutiveMisses >= MAX_CONSECUTIVE_MISSES_AFTER_TRACKING
      ) {
        const terminalEvent = createTerminalSnapshot(session.trackedEvent);
        await archiveSession(options.baseUrl, terminalEvent, session.history);
        session.archived = true;
        session.updatedAt = new Date().toISOString();
        await writeSession(sessionFilePath, session);
        console.log("[tracker] Match disappeared after tracking history existed. Archived as completed.");
        break;
      }

      console.log("[tracker] Match not returned in live discovery yet.");
      await sleep(options.cadenceSeconds * 1000);
      continue;
    }

    session.consecutiveMisses = 0;
    let nextEvent: LiveEvent = event;
    const refreshedState = await refreshMatchState(
      options.baseUrl,
      options.region,
      options.sport,
      event
    );
    if (refreshedState) {
      nextEvent = {
        ...event,
        live_state: refreshedState,
        freshness: {
          ...event.freshness,
          state_generated_at: refreshedState.freshness.generated_at,
          state_age_seconds: refreshedState.freshness.age_seconds
        }
      };
    }

    session.trackedEvent = nextEvent;
    session.history = appendHistory(session.history, nextEvent.live_state);
    session.updatedAt = new Date().toISOString();
    await writeSession(sessionFilePath, session);

    console.log(
      `[tracker] ${nextEvent.context?.match.match_name ?? nextEvent.match_id} :: ${nextEvent.live_state.score.display} :: ${nextEvent.live_state.period.display} :: ${nextEvent.live_state.clock.display}`
    );

    if (TERMINAL_MATCH_STATUSES.has(nextEvent.live_state.match_status)) {
      await archiveSession(options.baseUrl, nextEvent, session.history);
      session.archived = true;
      session.updatedAt = new Date().toISOString();
      await writeSession(sessionFilePath, session);
      console.log(`[tracker] Match reached terminal status ${nextEvent.live_state.match_status}. Archived.`);
      break;
    }

    await sleep(options.cadenceSeconds * 1000);
  }
};

void main().catch((error) => {
  console.error("[tracker] Fatal error:", error);
  process.exitCode = 1;
});
