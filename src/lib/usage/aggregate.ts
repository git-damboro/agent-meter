import type {
  DailyUsagePoint,
  UsageRecord,
  UsageSummary,
} from "@/lib/usage/types";

export function aggregateDailyUsage(records: UsageRecord[]): DailyUsagePoint[] {
  const byDate = new Map<string, DailyUsagePoint>();

  for (const record of records) {
    const current = byDate.get(record.date) ?? {
      date: record.date,
      tokens: 0,
    };

    current.tokens += record.tokens;
    if (record.costRmb !== undefined) {
      current.costRmb = (current.costRmb ?? 0) + record.costRmb;
    }
    byDate.set(record.date, current);
  }

  return Array.from(byDate.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export function summarizeDailyUsage(daily: DailyUsagePoint[]): UsageSummary {
  if (daily.length === 0) {
    return {
      totalTokens: 0,
      peakDailyTokens: 0,
      activeDays: 0,
    };
  }

  const totalCostRmb = daily.reduce<number | undefined>((total, point) => {
    if (point.costRmb === undefined) {
      return total;
    }
    return (total ?? 0) + point.costRmb;
  }, undefined);

  return {
    totalTokens: daily.reduce((total, point) => total + point.tokens, 0),
    totalCostRmb,
    peakDailyTokens: Math.max(...daily.map((point) => point.tokens)),
    activeDays: daily.filter((point) => point.tokens > 0).length,
    rangeStart: daily[0]?.date,
    rangeEnd: daily.at(-1)?.date,
  };
}
