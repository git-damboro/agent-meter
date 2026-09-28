import type {
  CodexAccountResponse,
  CodexQuotaWindow,
  CodexRateLimitsResponse,
  CodexTokenUsageResponse,
  CodexUsageSnapshot,
} from "@/lib/codex/types";

export function mapCodexUsageSnapshot(
  account: CodexAccountResponse,
  usage: CodexTokenUsageResponse,
  rateLimits: CodexRateLimitsResponse,
): CodexUsageSnapshot {
  const primary = mapWindow(rateLimits.rateLimits.primary);
  const secondary = mapWindow(rateLimits.rateLimits.secondary);

  return {
    source: "codex",
    fetchedAt: new Date().toISOString(),
    account: {
      email: account.account?.email ?? undefined,
      planType:
        account.account?.planType ??
        rateLimits.rateLimits.planType ??
        undefined,
    },
    summary: {
      lifetimeTokens: usage.summary.lifetimeTokens ?? undefined,
      peakDailyTokens: usage.summary.peakDailyTokens ?? undefined,
      longestRunningTurnSec:
        usage.summary.longestRunningTurnSec ?? undefined,
      currentStreakDays: usage.summary.currentStreakDays ?? undefined,
      longestStreakDays: usage.summary.longestStreakDays ?? undefined,
    },
    daily:
      usage.dailyUsageBuckets?.map((point) => ({
        date: point.startDate,
        tokens: point.tokens,
      })) ?? [],
    quota: {
      ordinaryUsageAllowed:
        rateLimits.ordinaryUsageAllowed ?? undefined,
      primary,
      secondary,
      availableResetCredits:
        rateLimits.rateLimitResetCredits?.availableCount ?? undefined,
    },
  };
}

function mapWindow(
  window:
    | {
        usedPercent: number;
        windowDurationMins?: number | null;
        resetsAt?: number | null;
      }
    | null
    | undefined,
): CodexQuotaWindow | undefined {
  if (!window) {
    return undefined;
  }

  return {
    usedPercent: window.usedPercent,
    windowDurationMins: window.windowDurationMins ?? undefined,
    resetsAt: window.resetsAt ?? undefined,
  };
}
