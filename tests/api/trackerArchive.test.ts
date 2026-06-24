import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MockLiveEventDiscoveryProvider } from "../../src/server/providers/mock/mockProviders";
import {
  listTrackerArchivesAt,
  readTrackerArchive,
  saveTrackerArchive
} from "../../src/server/lib/tracker-archive";

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("tracker archive store", () => {
  it("saves, lists, and reads archived tracked events", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "tracker-archive-"));
    createdDirs.push(baseDir);
    const provider = new MockLiveEventDiscoveryProvider();
    const discovery = await provider.discover({
      region: "north-america",
      sport: "soccer",
      include_context: true,
      known_matches: []
    });
    const event = discovery.events[0];

    const archive = await saveTrackerArchive(
      {
        event,
        history: [
          {
            capturedAt: event.live_state.freshness.generated_at,
            liveState: event.live_state
          }
        ]
      },
      baseDir
    );

    expect(archive.summary.match_id).toBe(event.match_id);
    expect(archive.summary.history_points).toBe(1);

    const summaries = await listTrackerArchivesAt(baseDir);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].archive_id).toBe(archive.summary.archive_id);

    const loaded = await readTrackerArchive(archive.summary.archive_id, baseDir);
    expect(loaded?.event.match_id).toBe(event.match_id);
    expect(loaded?.history).toHaveLength(1);
  });

  it("surfaces saved tracker sessions in history when no formal archive exists", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "tracker-session-"));
    createdDirs.push(baseDir);
    const provider = new MockLiveEventDiscoveryProvider();
    const discovery = await provider.discover({
      region: "north-america",
      sport: "soccer",
      include_context: true,
      known_matches: []
    });
    const event = discovery.events[0];
    const day = event.context?.match.scheduled_start_time.slice(0, 10) ?? "2026-01-01";
    const sessionDir = join(
      baseDir,
      "logs",
      "match-tracker-sessions",
      day,
      "test-match"
    );
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      join(sessionDir, "session.json"),
      JSON.stringify(
        {
          trackedEvent: event,
          history: [
            {
              capturedAt: event.live_state.freshness.generated_at,
              liveState: event.live_state
            }
          ],
          updatedAt: event.live_state.freshness.generated_at
        },
        null,
        2
      )
    );

    const summaries = await listTrackerArchivesAt(baseDir);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].archive_id).toBe(`session__${day}__test-match`);

    const loaded = await readTrackerArchive(
      `session__${day}__test-match`,
      baseDir
    );
    expect(loaded?.event.match_id).toBe(event.match_id);
    expect(loaded?.history).toHaveLength(1);
  });
});
