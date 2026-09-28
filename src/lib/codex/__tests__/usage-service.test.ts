import { describe, expect, it } from "vitest";

import {
  codexAccountResponseSchema,
  codexRateLimitsResponseSchema,
  codexTokenUsageResponseSchema,
} from "@/lib/codex/types";
import { mapCodexUsageSnapshot } from "@/lib/codex/mapper";

describe("mapCodexUsageSnapshot", () => {
  it("keeps subscription usage and quota windows separate", () => {
    const result = mapCodexUsageSnapshot(
      codexAccountResponseSchema.parse({
        account: {
          type: "chatgpt",
          email: "user@example.com",
          planType: "plus",
        },
        requiresOpenaiAuth: true,
      }),
      codexTokenUsageResponseSchema.parse({
        summary: {
          lifetimeTokens: 1_250_000,
          peakDailyTokens: 120_000,
          longestRunningTurnSec: 840,
          currentStreakDays: 4,
          longestStreakDays: 11,
        },
        dailyUsageBuckets: [
          { startDate: "2026-09-26", tokens: 40_000 },
          { startDate: "2026-09-27", tokens: 75_000 },
        ],
      }),
      codexRateLimitsResponseSchema.parse({
        ordinaryUsageAllowed: true,
        rateLimits: {
          planType: "plus",
          primary: {
            usedPercent: 27,
            windowDurationMins: 300,
            resetsAt: 1_790_000_000,
          },
          secondary: {
            usedPercent: 4,
            windowDurationMins: 10_080,
            resetsAt: 1_790_500_000,
          },
        },
        rateLimitResetCredits: {
          availableCount: 2,
        },
      }),
    );

    expect(result.account).toEqual({
      email: "user@example.com",
      planType: "plus",
    });
    expect(result.summary.lifetimeTokens).toBe(1_250_000);
    expect(result.daily).toHaveLength(2);
    expect(result.quota.primary).toEqual({
      usedPercent: 27,
      windowDurationMins: 300,
      resetsAt: 1_790_000_000,
    });
    expect(result.quota.availableResetCredits).toBe(2);
  });
});
