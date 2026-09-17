export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatMetric(status: "measured" | "estimated" | "unavailable", value: number | null, unit: "ms" | "" = "ms"): string {
  if (status === "unavailable" || value === null) return "—";
  const formatted = unit === "ms" ? formatMs(value) : value.toFixed(3);
  return status === "estimated" ? `~${formatted}` : formatted;
}

export function shortDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function severityColor(severity: "critical" | "high" | "medium" | "low"): string {
  switch (severity) {
    case "critical":
      return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900";
    case "high":
      return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900";
    case "medium":
      return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900";
    case "low":
      return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800";
  }
}

export function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

export function vitalStatus(metric: "lcp" | "fcp" | "cls", value: number): "Good" | "Needs Improvement" | "Poor" {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fcp: [1800, 3000],
    cls: [0.1, 0.25],
  };
  const [good, poor] = thresholds[metric];
  if (value <= good) return "Good";
  if (value <= poor) return "Needs Improvement";
  return "Poor";
}
