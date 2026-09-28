import { join } from "node:path";

import {
  codexUsageSnapshotSchema,
  type CodexUsageSnapshot,
} from "@/lib/codex/types";
import {
  readJsonFile,
  writeJsonAtomic,
} from "@/lib/storage/atomic-json";

const SNAPSHOT_FILE_NAME = "codex-usage.json";

export function getAgentMeterDataDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.AGENT_METER_DATA_DIR?.trim() || join(process.cwd(), ".agent-meter");
}

export function getCodexSnapshotPath(dataDir = getAgentMeterDataDir()): string {
  return join(dataDir, SNAPSHOT_FILE_NAME);
}

export function sanitizeCodexUsageSnapshot(
  snapshot: CodexUsageSnapshot,
): CodexUsageSnapshot {
  const parsed = codexUsageSnapshotSchema.parse(snapshot);
  return codexUsageSnapshotSchema.parse({
    ...parsed,
    account: {
      planType: parsed.account.planType,
    },
  });
}

export async function readCodexSnapshot(
  dataDir = getAgentMeterDataDir(),
): Promise<CodexUsageSnapshot> {
  return codexUsageSnapshotSchema.parse(
    await readJsonFile(getCodexSnapshotPath(dataDir)),
  );
}

export async function writeCodexSnapshot(
  snapshot: CodexUsageSnapshot,
  dataDir = getAgentMeterDataDir(),
): Promise<CodexUsageSnapshot> {
  const sanitized = sanitizeCodexUsageSnapshot(snapshot);
  await writeJsonAtomic(getCodexSnapshotPath(dataDir), sanitized);
  return sanitized;
}
