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

const buildArchiveSummary = (
  input: TrackerArchiveCreateInput,
  archivedAt: string
): TrackerArchiveSummary => {
  const day = getArchiveDay(input.event);
  const eventFolder = getArchiveEventFolder(input.event);
  return {
    archive_id: `${day}__${eventFolder}`,
    archived_at: archivedAt,
    match_id: input.event.match_id,
    match_name: input.event.context?.match.match_name ?? input.event.match_id,
    sport: input.event.context?.match.sport ?? "unknown",
    tournament_name:
      input.event.context?.match.tournament_name ?? "Unknown Tournament",
    scheduled_start_time:
      input.event.context?.match.scheduled_start_time ??
      input.event.live_state.freshness.generated_at,
    venue_summary: buildVenueSummary(input.event),
    final_status: input.event.live_state.match_status,
    final_score_display: input.event.live_state.score.display,
    history_points: input.history.length
  };
};

const getArchiveFilePath = (archiveId: string, baseDir = process.cwd()): string => {
  const [day, eventFolder] = archiveId.split("__");
  if (!day || !eventFolder) {
    throw new Error("Invalid tracker archive id.");
  }

  return resolve(baseDir, ARCHIVE_ROOT, day, eventFolder, "archive.json");
};

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
  const root = resolve(baseDir, ARCHIVE_ROOT);
  if (!existsSync(root)) {
    return [];
  }

  const summaries: TrackerArchiveSummary[] = [];
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

  const payload = JSON.parse(await readFile(filePath, "utf8"));
  return trackerArchiveSchema.parse(payload);
};
