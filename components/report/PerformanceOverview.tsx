import type { AuditResult } from "@/types/audit";
import { formatBytes, formatMs, formatMetric, vitalStatus } from "@/lib/format";
import { ScoreRing } from "@/components/report/ScoreRing";
import { Card, MetricBadge } from "@/components/ui/Card";
import { Clock, HardDrive, Network } from "lucide-react";

export function PerformanceOverview({ result }: { result: AuditResult }) {
  const stats = [
    { icon: Clock, label: "Load Time", value: formatMs(result.metrics.loadTimeMs) },
    { icon: HardDrive, label: "Page Size", value: formatBytes(result.pageSizeBytes) },
    { icon: Network, label: "Requests", value: String(result.requestCount) },
  ];

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
        <div className="flex items-center gap-6">
          <ScoreRing score={result.score.overall} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">Performance Score</p>
            <p className="mt-1 text-sm text-foreground/60">
              {result.score.overall >= 90 ? "Excellent" : result.score.overall >= 50 ? "Needs work" : "Poor"} · scanned as{" "}
              {result.device}
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-3 sm:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border-subtle p-3 sm:p-4">
              <s.icon size={16} className="mb-2 text-foreground/40" />
              <p className="text-lg font-semibold sm:text-xl">{s.value}</p>
              <p className="text-xs text-foreground/50">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 border-t border-border-subtle pt-6 sm:grid-cols-3">
        <VitalStat title="LCP" description="Largest Contentful Paint" metric={result.metrics.lcp} kind="lcp" />
        <VitalStat title="FCP" description="First Contentful Paint" metric={result.metrics.fcp} kind="fcp" />
        <VitalStat title="CLS" description="Cumulative Layout Shift" metric={result.metrics.cls} kind="cls" unit="" />
      </div>
    </Card>
  );
}

function VitalStat({
  title,
  description,
  metric,
  kind,
  unit = "ms",
}: {
  title: string;
  description: string;
  metric: { status: "measured" | "estimated" | "unavailable"; value: number | null };
  kind: "lcp" | "fcp" | "cls";
  unit?: "ms" | "";
}) {
  const status = metric.value !== null ? vitalStatus(kind, metric.value) : null;
  const statusColor =
    status === "Good" ? "text-emerald-600 dark:text-emerald-400" : status === "Poor" ? "text-red-500" : "text-amber-500";

  return (
    <div className="flex items-center justify-between rounded-xl border border-border-subtle p-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold">{title}</p>
          <MetricBadge label={metric.status} />
        </div>
        <p className="text-xs text-foreground/45">{description}</p>
      </div>
      <div className="text-right">
        <p className="mono text-lg font-semibold">{formatMetric(metric.status, metric.value, unit)}</p>
        {status && <p className={`text-xs font-medium ${statusColor}`}>{status}</p>}
      </div>
    </div>
  );
}
