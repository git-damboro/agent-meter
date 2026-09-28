export function formatTokenCount(value?: number): string {
  if (value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatExactNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatRmb(value?: number): string {
  if (value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined) {
    return "—";
  }

  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分`;
  }
  return `${minutes} 分`;
}

export function formatDateTime(unixSeconds?: number): string {
  if (unixSeconds === undefined) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1_000));
}

export function formatDateRange(start?: string, end?: string): string {
  if (!start || !end) {
    return "—";
  }
  return `${start.slice(5)} – ${end.slice(5)}`;
}
