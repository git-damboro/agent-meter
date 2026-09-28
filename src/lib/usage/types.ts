export type UsageSource = "codex" | "bytedance";

export interface UsageRecord {
  date: string;
  tokens: number;
  costRmb?: number;
  curve?: string;
  department?: string;
  modelFamily?: string;
  model?: string;
}

export interface DailyUsagePoint {
  date: string;
  tokens: number;
  costRmb?: number;
}

export interface UsageSummary {
  totalTokens: number;
  totalCostRmb?: number;
  peakDailyTokens: number;
  activeDays: number;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface UsageDataset {
  id: string;
  source: UsageSource;
  label: string;
  importedAt: string;
  records: UsageRecord[];
  daily: DailyUsagePoint[];
  summary: UsageSummary;
}

export interface UsageImportResult {
  dataset: UsageDataset;
  warnings: string[];
}
