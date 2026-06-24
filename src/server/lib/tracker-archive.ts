import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  LiveEvent,
  TrackerArchive,
  TrackerArchiveCreateInput,
  TrackerArchiveSummary
} from "../../shared/schemas/live";
import {
  trackerArchiveCreateSchema,
  trackerArchiveSchema
} from "../../shared/schemas/live";

const ARCHIVE_ROOT = "logs/tracker-archives";
const SESSION_ROOT = "logs/match-tracker-sessions";
const SESSION_ARCHIVE_PREFIX = "session__";

type TrackerSessionSnapshot = {
  trackedEvent: LiveEvent | null;
  history: TrackerArchiveCreateInput["history"];
  updatedAt: string;
};

const sanitizePathToken = (value: string): string =>
  value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
  "unknown";

const getArchiveDay = (event: LiveEvent): string =>
  event.context?.match.scheduled_start_time.slice(0, 10) ??
  new Date().toISOString().slice(0, 10);

const getArchiveEventFolder = (event: LiveEvent): string =>
  sanitizePathToken(event.match_id);

const buildVenueSummary = (event: LiveEvent): string => {
  const venue = event.context?.match.venue;
  if (!venue) {
    return "Unknown venue";
  }

  return [venue.stadium, venue.city, venue.state, venue.country]
    .filter(Boolean)
    .join(", ");
};

const buildArchiveSummaryFromEvent = (
  event: LiveEvent,
  archivedAt: string,
  archiveId: string,
  historyPoints: number
): TrackerArchiveSummary => ({
  archive_id: archiveId,
  archived_at: archivedAt,
  match_id: event.match_id,
  match_name: event.context?.match.match_name ?? event.match_id,
  sport: event.context?.match.sport ?? "unknown",
  tournament_name:
    event.context?.match.tournament_name ?? "Unknown Tournament",
  scheduled_start_time:
    event.context?.match.scheduled_start_time ??
    event.live_state.freshness.generated_at,
  venue_summary: buildVenueSummary(event),
  final_status: event.live_state.match_status,
  final_score_display: event.live_state.score.display,
  history_points: historyPoints
});

const buildArchiveSummary = (
  input: TrackerArchiveCreateInput,
  archivedAt: string
): TrackerArchiveSummary => {
  const day = getArchiveDay(input.event);
  const eventFolder = getArchiveEventFolder(input.event);
  return buildArchiveSummaryFromEvent(
    input.event,
    archivedAt,
    `${day}__${eventFolder}`,
    input.history.length
  );
};

const getArchiveFilePath = (archiveId: string, baseDir = process.cwd()): string => {
  if (archiveId.startsWith(SESSION_ARCHIVE_PREFIX)) {
    const [, day, eventFolder] = archiveId.split("__");
    if (!day || !eventFolder) {
      throw new Error("Invalid tracker session archive id.");
    }

    return resolve(baseDir, SESSION_ROOT, day, eventFolder, "session.json");
  }

  const [day, eventFolder] = archiveId.split("__");
  if (!day || !eventFolder) {
    throw new Error("Invalid tracker archive id.");
  }

  return resolve(baseDir, ARCHIVE_ROOT, day, eventFolder, "archive.json");
};

const parseSessionSnapshot = async (
  filePath: string
): Promise<TrackerSessionSnapshot | null> => {
  const payload = JSON.parse(await readFile(filePath, "utf8")) as TrackerSessionSnapshot;
  if (!payload.trackedEvent || payload.history.length === 0) {
    return null;
  }

  return payload;
};

const buildArchiveFromSession = (
  day: string,
  eventFolder: string,
  session: TrackerSessionSnapshot
): TrackerArchive => ({
  summary: buildArchiveSummaryFromEvent(
    session.trackedEvent as LiveEvent,
    session.updatedAt,
    `${SESSION_ARCHIVE_PREFIX}${day}__${eventFolder}`,
    session.history.length
  ),
  event: session.trackedEvent as LiveEvent,
  history: session.history
});

export const saveTrackerArchive = async (
  input: TrackerArchiveCreateInput,
  baseDir = process.cwd()
): Promise<TrackerArchive> => {
  const parsed = trackerArchiveCreateSchema.parse(input);
  const archivedAt = new Date().toISOString();
  const summary = buildArchiveSummary(parsed, archivedAt);
  const archive: TrackerArchive = {
    summary,
    event: parsed.event,
    history: parsed.history
  };

  const filePath = getArchiveFilePath(summary.archive_id, baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(`${filePath}`, `${JSON.stringify(archive, null, 2)}\n`, "utf8");

  return archive;
};

export const listTrackerArchives = async (): Promise<TrackerArchiveSummary[]> => {
  return listTrackerArchivesAt(process.cwd());
};

export const listTrackerArchivesAt = async (
  baseDir: string
): Promise<TrackerArchiveSummary[]> => {
  const summaries: TrackerArchiveSummary[] = [];
  const archivedMatchIds = new Set<string>();
  const root = resolve(baseDir, ARCHIVE_ROOT);
  if (existsSync(root)) {
    const dayEntries = await readdir(root, { withFileTypes: true });

    for (const dayEntry of dayEntries) {
      if (!dayEntry.isDirectory()) {
        continue;
      }

      const dayPath = resolve(root, dayEntry.name);
      const eventEntries = await readdir(dayPath, { withFileTypes: true });
      for (const eventEntry of eventEntries) {
        if (!eventEntry.isDirectory()) {
          continue;
        }

        const filePath = resolve(dayPath, eventEntry.name, "archive.json");
        if (!existsSync(filePath)) {
          continue;
        }

        const payload = JSON.parse(await readFile(filePath, "utf8"));
        const archive = trackerArchiveSchema.parse(payload);
        summaries.push(archive.summary);
        archivedMatchIds.add(archive.event.match_id);
      }
    }
  }

  const sessionRoot = resolve(baseDir, SESSION_ROOT);
  if (existsSync(sessionRoot)) {
    const dayEntries = await readdir(sessionRoot, { withFileTypes: true });

    for (const dayEntry of dayEntries) {
      if (!dayEntry.isDirectory()) {
        continue;
      }

      const dayPath = resolve(sessionRoot, dayEntry.name);
      const eventEntries = await readdir(dayPath, { withFileTypes: true });
      for (const eventEntry of eventEntries) {
        if (!eventEntry.isDirectory()) {
          continue;
        }

        const filePath = resolve(dayPath, eventEntry.name, "session.json");
        if (!existsSync(filePath)) {
          continue;
        }

        const session = await parseSessionSnapshot(filePath);
        if (!session || !session.trackedEvent) {
          continue;
        }

        if (archivedMatchIds.has(session.trackedEvent.match_id)) {
          continue;
        }

        const sessionArchive = buildArchiveFromSession(
          dayEntry.name,
          eventEntry.name,
          session
        );
        summaries.push(sessionArchive.summary);
      }
    }
  }

  return summaries.sort((left, right) =>
    right.archived_at.localeCompare(left.archived_at)
  );
};

export const readTrackerArchive = async (
  archiveId: string,
  baseDir = process.cwd()
): Promise<TrackerArchive | null> => {
  const filePath = getArchiveFilePath(archiveId, baseDir);
  if (!existsSync(filePath)) {
    return null;
  }

  if (archiveId.startsWith(SESSION_ARCHIVE_PREFIX)) {
    const [, day, eventFolder] = archiveId.split("__");
    if (!day || !eventFolder) {
      return null;
    }

    const session = await parseSessionSnapshot(filePath);
    if (!session) {
      return null;
    }

    return buildArchiveFromSession(day, eventFolder, session);
  }

  const payload = JSON.parse(await readFile(filePath, "utf8"));
  return trackerArchiveSchema.parse(payload);
};
