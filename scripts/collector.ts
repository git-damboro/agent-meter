import {
  collectCodexUsageOnce,
  formatCollectorError,
  getCollectorIntervalMs,
} from "@/lib/codex/collector";

const once = process.argv.includes("--once");
let stopping = false;
let wake: (() => void) | undefined;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    wake?.();
  });
}

async function main(): Promise<void> {
  const intervalMs = getCollectorIntervalMs();

  do {
    try {
      const snapshot = await collectCodexUsageOnce();
      console.log(
        `[AgentMeter] Codex snapshot updated at ${snapshot.fetchedAt}.`,
      );
    } catch (error) {
      console.error(`[AgentMeter] ${formatCollectorError(error)}`);
      if (once) {
        process.exitCode = 1;
        return;
      }
    }

    if (!once && !stopping) {
      await waitForNextRun(intervalMs);
    }
  } while (!once && !stopping);
}

function waitForNextRun(intervalMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wake = undefined;
      resolve();
    }, intervalMs);
    wake = () => {
      clearTimeout(timer);
      wake = undefined;
      resolve();
    };
  });
}

await main();
