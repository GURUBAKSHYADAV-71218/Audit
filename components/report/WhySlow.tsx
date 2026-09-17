import type { AuditResult } from "@/types/audit";
import { formatBytes } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Zap } from "lucide-react";

export function WhySlow({ result }: { result: AuditResult }) {
  const maxBytes = Math.max(...result.diagnosis.topContributors.map((c) => c.bytes), 1);

  return (
    <div>
      <SectionHeading eyebrow="The Diagnosis" title="Why is this slow?" />
      <Card className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Zap size={18} />
          </span>
          <p className="text-lg font-medium leading-snug sm:text-xl">{result.diagnosis.summary}</p>
        </div>

        {result.diagnosis.topContributors.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/40">Top Contributors</p>
            <div className="space-y-2.5">
              {result.diagnosis.topContributors.map((c, i) => (
                <div key={c.label + i} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-right text-xs text-foreground/35 mono">{i + 1}</span>
                  <span className="w-40 shrink-0 truncate text-sm mono sm:w-64">{c.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-border-subtle">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${Math.max(4, (c.bytes / maxBytes) * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-medium mono">{formatBytes(c.bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
