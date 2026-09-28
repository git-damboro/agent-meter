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

const codexHttpRateLimitWindowSchema = z
  .object({
    used_percent: z.number(),
    limit_window_seconds: nullableNumber,
    reset_at: nullableNumber,
  })
  .passthrough();

export const codexHttpProfileResponseSchema = z
  .object({
    stats: z
      .object({
        lifetime_tokens: nullableNumber,
        peak_daily_tokens: nullableNumber,
        longest_running_turn_sec: nullableNumber,
        current_streak_days: nullableNumber,
        longest_streak_days: nullableNumber,
        daily_usage_buckets: z
          .array(
            z.object({
              start_date: z.string(),
              tokens: z.number(),
            }),
          )
          .nullable()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const codexHttpUsageResponseSchema = z
  .object({
    plan_type: z.string().nullable().optional(),
    rate_limit: z
      .object({
        allowed: z.boolean().nullable().optional(),
        primary_window: codexHttpRateLimitWindowSchema.nullable().optional(),
        secondary_window: codexHttpRateLimitWindowSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    rate_limit_reset_credits: z
      .object({
        available_count: z.number(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const codexPersonalAccessTokenMetadataSchema = z.object({
  email: z.string().nullable().optional(),
  chatgpt_account_id: z.string().min(1),
  chatgpt_user_id: z.string().min(1),
  chatgpt_plan_type: z.string().min(1),
});

export type CodexAccountResponse = z.infer<typeof codexAccountResponseSchema>;
export type CodexRateLimitsResponse = z.infer<
  typeof codexRateLimitsResponseSchema
>;
export type CodexTokenUsageResponse = z.infer<
  typeof codexTokenUsageResponseSchema
>;
export type CodexHttpProfileResponse = z.infer<
  typeof codexHttpProfileResponseSchema
>;
export type CodexHttpUsageResponse = z.infer<
  typeof codexHttpUsageResponseSchema
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
