import { z } from "zod";

const nullableNumber = z.number().nullable().optional();

export const codexAccountResponseSchema = z.object({
  account: z
    .object({
      type: z.string(),
      email: z.string().nullable().optional(),
      planType: z.string().optional(),
    })
    .passthrough()
    .nullable(),
  requiresOpenaiAuth: z.boolean(),
});

const rateLimitWindowSchema = z
  .object({
    usedPercent: z.number(),
    windowDurationMins: nullableNumber,
    resetsAt: nullableNumber,
  })
  .passthrough();

const rateLimitSnapshotSchema = z
  .object({
    planType: z.string().nullable().optional(),
    primary: rateLimitWindowSchema.nullable().optional(),
    secondary: rateLimitWindowSchema.nullable().optional(),
  })
  .passthrough();

export const codexRateLimitsResponseSchema = z
  .object({
    ordinaryUsageAllowed: z.boolean().nullable().optional(),
    rateLimits: rateLimitSnapshotSchema,
    rateLimitResetCredits: z
      .object({
        availableCount: z.number(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const codexTokenUsageResponseSchema = z
  .object({
    summary: z.object({
      lifetimeTokens: nullableNumber,
      peakDailyTokens: nullableNumber,
      longestRunningTurnSec: nullableNumber,
      currentStreakDays: nullableNumber,
      longestStreakDays: nullableNumber,
    }),
    dailyUsageBuckets: z
      .array(
        z.object({
          startDate: z.string(),
          tokens: z.number(),
        }),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

export type CodexAccountResponse = z.infer<typeof codexAccountResponseSchema>;
export type CodexRateLimitsResponse = z.infer<
  typeof codexRateLimitsResponseSchema
>;
export type CodexTokenUsageResponse = z.infer<
  typeof codexTokenUsageResponseSchema
>;

export interface CodexQuotaWindow {
  usedPercent: number;
  windowDurationMins?: number;
  resetsAt?: number;
}

export interface CodexUsageSnapshot {
  source: "codex";
  fetchedAt: string;
  account: {
    email?: string;
    planType?: string;
  };
  summary: {
    lifetimeTokens?: number;
    peakDailyTokens?: number;
    longestRunningTurnSec?: number;
    currentStreakDays?: number;
    longestStreakDays?: number;
  };
  daily: Array<{
    date: string;
    tokens: number;
  }>;
  quota: {
    ordinaryUsageAllowed?: boolean;
    primary?: CodexQuotaWindow;
    secondary?: CodexQuotaWindow;
    availableResetCredits?: number;
  };
}
