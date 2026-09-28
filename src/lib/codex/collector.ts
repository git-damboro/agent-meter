import {
  loadCodexServerCredential,
  persistCodexOAuthCredential,
} from "@/lib/codex/credential-store";
import {
  CodexProviderError,
  fetchCodexUsageWithCredential,
} from "@/lib/codex/http-provider";
import {
  getAgentMeterDataDir,
  writeCodexSnapshot,
} from "@/lib/codex/snapshot-store";
import type { CodexUsageSnapshot } from "@/lib/codex/types";

interface CollectCodexUsageOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export async function collectCodexUsageOnce(
  options: CollectCodexUsageOptions = {},
): Promise<CodexUsageSnapshot> {
  const env = options.env ?? process.env;
  const loaded = await loadCodexServerCredential(env);
  const result = await fetchCodexUsageWithCredential(loaded.credential, {
    fetchImpl: options.fetchImpl,
    now: options.now,
    onCredentialRefreshed: async (credential) => {
      await persistCodexOAuthCredential(
        loaded.credentialPath,
        credential,
        loaded.credentialVersion,
      );
    },
  });

  return writeCodexSnapshot(result.snapshot, getAgentMeterDataDir(env));
}

export function getCollectorIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.AGENT_METER_COLLECT_INTERVAL_SECONDS;
  if (!raw) {
    return 60 * 60 * 1000;
  }
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 60) {
    throw new CodexProviderError(
      "CODEX_CONFIGURATION_ERROR",
      "AGENT_METER_COLLECT_INTERVAL_SECONDS must be an integer of at least 60.",
    );
  }
  return seconds * 1000;
}

export function formatCollectorError(error: unknown): string {
  if (error instanceof CodexProviderError) {
    const status = error.status ? ` (HTTP ${error.status})` : "";
    return `${error.code}${status}: ${error.message}`;
  }
  return "CODEX_COLLECTOR_ERROR: Unexpected collector failure.";
}
