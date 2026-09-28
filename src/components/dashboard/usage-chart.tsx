"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatExactNumber } from "@/lib/format";
import type { DailyUsagePoint } from "@/lib/usage/types";

export type UsageChartMode = "daily" | "weekly" | "cumulative";

interface UsageChartProps {
  daily: DailyUsagePoint[];
  mode: UsageChartMode;
}

export function UsageChart({ daily, mode }: UsageChartProps) {
  const series = buildSeries(daily, mode);

  if (series.length === 0) {
    return (
      <div className="chart-empty">
        <span>等待数据</span>
      </div>
    );
  }

  return (
    <div className="chart-shell" aria-label="Token 用量趋势图">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={series}
          margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="3 5"
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval="preserveStartEnd"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickFormatter={formatTokenCountForAxis}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: 6,
              boxShadow: "0 12px 30px rgba(20, 28, 35, 0.12)",
              color: "var(--ink)",
            }}
            cursor={{ fill: "var(--hover)" }}
            formatter={(value) => [
              `${formatExactNumber(Number(value ?? 0))} Token`,
              "用量",
            ]}
            labelStyle={{ color: "var(--muted)", marginBottom: 6 }}
          />
          {mode === "cumulative" ? (
            <Line
              dataKey="tokens"
              dot={false}
              isAnimationActive={false}
              stroke="var(--source)"
              strokeWidth={2}
              type="monotone"
            />
          ) : (
            <Bar
              dataKey="tokens"
              fill="var(--source)"
              isAnimationActive={false}
              maxBarSize={18}
              radius={[2, 2, 0, 0]}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildSeries(daily: DailyUsagePoint[], mode: UsageChartMode) {
  const ordered = [...daily].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  if (mode === "weekly") {
    const weekly = new Map<string, number>();
    for (const point of ordered) {
      const week = getMonday(point.date);
      weekly.set(week, (weekly.get(week) ?? 0) + point.tokens);
    }
    return Array.from(weekly, ([date, tokens]) => ({
      date,
      label: date.slice(5),
      tokens,
    }));
  }

  if (mode === "cumulative") {
    let total = 0;
    return ordered.map((point) => {
      total += point.tokens;
      return {
        date: point.date,
        label: point.date.slice(5),
        tokens: total,
      };
    });
  }

  return ordered.map((point) => ({
    date: point.date,
    label: point.date.slice(5),
    tokens: point.tokens,
  }));
}

function getMonday(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function formatTokenCountForAxis(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}亿`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(0)}万`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}
