import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getCodexSnapshotPath,
  readCodexSnapshot,
  writeCodexSnapshot,
} from "@/lib/codex/snapshot-store";
import type { CodexUsageSnapshot } from "@/lib/codex/types";

describe("Codex snapshot store", () => {
  it("atomically persists only the public snapshot shape", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-meter-snapshot-"));
    const snapshot = {
      source: "codex",
      fetchedAt: "2026-09-28T08:00:00.000Z",
      account: {
        email: "private@example.com",
        planType: "plus",
      },
      summary: {
        lifetimeTokens: 123,
      },
      daily: [{ date: "2026-09-28", tokens: 123 }],
      quota: {
        ordinaryUsageAllowed: true,
      },
      credential: "must-not-survive",
    } as CodexUsageSnapshot;

    const written = await writeCodexSnapshot(snapshot, dataDir);
    const storedText = await readFile(getCodexSnapshotPath(dataDir), "utf8");
    const stored = await readCodexSnapshot(dataDir);
    const files = await readdir(dataDir);
    const fileStat = await stat(getCodexSnapshotPath(dataDir));

    expect(written.account).toEqual({ planType: "plus" });
    expect(stored).toEqual(written);
    expect(storedText).not.toContain("private@example.com");
    expect(storedText).not.toContain("must-not-survive");
    expect(files).toEqual(["codex-usage.json"]);
    expect(fileStat.mode & 0o777).toBe(0o600);
  });
});
