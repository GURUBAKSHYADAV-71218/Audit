import { demoAudit } from "@/lib/demoData";
import { formatBytes } from "@/lib/format";
import { scoreColor, severityColor } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function ExamplePreview() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-20">
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Example Audit · Demo Data
        </span>
      </div>
      <Card className="overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="text-center">
            <div className={`text-5xl font-bold ${scoreColor(demoAudit.score)}`}>{demoAudit.score}</div>
            <p className="text-xs text-foreground/40">Score</p>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-4 text-center sm:text-left">
            <Stat label="Load Time" value={`${(demoAudit.loadTimeMs / 1000).toFixed(1)}s`} />
            <Stat label="Requests" value={String(demoAudit.requests)} />
            <Stat label="Page Size" value={`${demoAudit.pageSizeMb} MB`} />
          </div>
        </div>

        <div className="mt-6 border-t border-border-subtle pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/40">Detected issues</p>
          <div className="space-y-2">
            {demoAudit.topIssues.map((issue) => (
              <div key={issue.title} className="flex items-center gap-3 text-sm">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${severityColor(issue.severity)}`}>
                  {issue.severity}
                </span>
                <span className="font-medium">{issue.title}</span>
                <span className="hidden text-foreground/40 sm:inline">— {issue.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-border-subtle pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/40">Top contributors</p>
          <div className="space-y-2">
            {demoAudit.topContributors.map((c) => (
              <div key={c.label} className="flex items-center justify-between text-sm">
                <span className="mono text-foreground/70">{c.label}</span>
                <span className="mono font-medium">{formatBytes(c.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-foreground/40">{label}</p>
    </div>
  );
}
