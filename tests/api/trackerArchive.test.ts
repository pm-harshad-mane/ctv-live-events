import { mkdtempSync, rmSync } from "node:fs";
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
});
