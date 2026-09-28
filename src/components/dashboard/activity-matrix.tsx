"use client";

import { formatExactNumber } from "@/lib/format";
import type { DailyUsagePoint } from "@/lib/usage/types";

interface ActivityMatrixProps {
  daily: DailyUsagePoint[];
}

export function ActivityMatrix({ daily }: ActivityMatrixProps) {
  const points = daily.slice(-93);
  const max = Math.max(...points.map((point) => point.tokens), 0);

  if (points.length === 0) {
    return <div className="activity-empty">暂无活动记录</div>;
  }

  return (
    <div
      className="activity-matrix"
      aria-label={`最近 ${points.length} 个数据日的 Token 活动`}
    >
      {points.map((point) => {
        const level = getLevel(point.tokens, max);
        return (
          <span
            aria-label={`${point.date}，${formatExactNumber(point.tokens)} Token`}
            className="activity-cell"
            data-level={level}
            key={point.date}
            title={`${point.date} · ${formatExactNumber(point.tokens)} Token`}
          />
        );
      })}
    </div>
  );
}

function getLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) {
    return 0;
  }

  const ratio = value / max;
  if (ratio >= 0.75) {
    return 4;
  }
  if (ratio >= 0.45) {
    return 3;
  }
  if (ratio >= 0.2) {
    return 2;
  }
  return 1;
}
