import { aggregateDailyUsage, summarizeDailyUsage } from "@/lib/usage/aggregate";
import type {
  UsageDataset,
  UsageImportResult,
  UsageRecord,
} from "@/lib/usage/types";

type Field =
  | "date"
  | "tokens"
  | "costRmb"
  | "curve"
  | "department"
  | "modelFamily"
  | "model"
  | "status";

const HEADER_ALIASES: Record<Field, string[]> = {
  date: ["日期", "date"],
  tokens: ["token消耗", "tokenusage", "tokens", "token"],
  costRmb: ["成本(rmb)", "成本", "cost(rmb)", "cost"],
  curve: ["曲线", "curve"],
  department: ["部门", "department"],
  modelFamily: ["模型大类", "modelfamily"],
  model: ["模型", "model"],
  status: ["数据状态", "status"],
};

export class ByteDanceImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ByteDanceImportError";
  }
}

export function parseByteDanceMatrix(
  matrix: unknown[][],
  importedAt = new Date(),
): UsageImportResult {
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex === -1) {
    throw new ByteDanceImportError(
      "未找到表头，请确认文件包含“日期”和“Token消耗”列。",
    );
  }

  const header = matrix[headerIndex] ?? [];
  const fieldIndexes = resolveFieldIndexes(header);
  const records: UsageRecord[] = [];
  const warnings: string[] = [];

  for (const [offset, row] of matrix.slice(headerIndex + 1).entries()) {
    const sheetRow = headerIndex + offset + 2;
    if (isEmptyRow(row)) {
      continue;
    }

    const status = getText(row[fieldIndexes.status]);
    if (status && !["有数据", "ready", "valid"].includes(status.toLowerCase())) {
      continue;
    }

    const date = parseDate(row[fieldIndexes.date]);
    if (!date) {
      warnings.push(`第 ${sheetRow} 行日期无法识别，已跳过。`);
      continue;
    }

    const tokens = parseMetricNumber(row[fieldIndexes.tokens]);
    if (tokens === undefined) {
      warnings.push(`第 ${sheetRow} 行 Token 消耗无法识别，已跳过。`);
      continue;
    }

    const costRmb = parseMetricNumber(row[fieldIndexes.costRmb]);
    records.push({
      date,
      tokens,
      costRmb,
      curve: getText(row[fieldIndexes.curve]) || undefined,
      department: getText(row[fieldIndexes.department]) || undefined,
      modelFamily: getText(row[fieldIndexes.modelFamily]) || undefined,
      model: getText(row[fieldIndexes.model]) || undefined,
    });
  }

  if (records.length === 0) {
    throw new ByteDanceImportError("文件中没有可用的 Token 记录。");
  }

  const daily = aggregateDailyUsage(records);
  const dataset: UsageDataset = {
    id: `bytedance-${importedAt.getTime()}`,
    source: "bytedance",
    label: "字节工作区导入",
    importedAt: importedAt.toISOString(),
    records,
    daily,
    summary: summarizeDailyUsage(daily),
  };

  return { dataset, warnings };
}

function findHeaderRow(matrix: unknown[][]): number {
  return matrix.slice(0, 20).findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return (
      normalized.some((value) => HEADER_ALIASES.date.includes(value)) &&
      normalized.some((value) => HEADER_ALIASES.tokens.includes(value))
    );
  });
}

function resolveFieldIndexes(header: unknown[]): Record<Field, number> {
  const normalized = header.map(normalizeHeader);

  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
      field,
      normalized.findIndex((value) => aliases.includes(value)),
    ]),
  ) as Record<Field, number>;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("（", "(")
    .replaceAll("）", ")")
    .replace(/\s+/g, "");
}

function getText(value: unknown): string {
  return String(value ?? "").trim();
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((value) => value === null || getText(value) === "");
}

function parseMetricNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = getText(value)
    .replace(/[,\s￥¥]/g, "")
    .replace(/rmb$/i, "");
  if (!raw) {
    return undefined;
  }

  const unit = raw.at(-1);
  const multiplier = unit === "亿" ? 100_000_000 : unit === "万" ? 10_000 : 1;
  const numeric = Number(multiplier === 1 ? raw : raw.slice(0, -1));
  return Number.isFinite(numeric) ? numeric * multiplier : undefined;
}

function parseDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return toIsoDate(new Date(excelEpoch + Math.round(value) * 86_400_000));
  }

  const raw = getText(value);
  const match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  return toIsoDate(date);
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
