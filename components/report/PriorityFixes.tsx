"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { Issue } from "@/types/audit";
import { formatBytes, formatMs, severityColor } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";

export function PriorityFixes({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <div>
        <SectionHeading eyebrow="Recommendations" title="Fix these first" />
        <Card className="p-8 text-center text-foreground/60">No significant issues were detected on this scan. Nice work.</Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        eyebrow="Recommendations"
        title="Fix these first"
        description="Ordered by severity. Potential savings are estimates, not guarantees."
      />
      <div className="space-y-3">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const colorClasses = severityColor(issue.severity);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className={clsx("shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide", colorClasses)}>
          {issue.severity}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{issue.title}</p>
          <p className="truncate text-xs text-foreground/45">{issue.category.replace("-", " ")}</p>
        </div>
        {(issue.potentialSavingsBytes || issue.potentialSavingsMs) && (
          <span className="hidden shrink-0 text-sm font-medium text-emerald-600 dark:text-emerald-400 sm:block">
            ~{issue.potentialSavingsBytes ? formatBytes(issue.potentialSavingsBytes) : formatMs(issue.potentialSavingsMs!)} saved
          </span>
        )}
        <ChevronDown size={18} className={clsx("shrink-0 text-foreground/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border-subtle px-5 py-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/40">Evidence</p>
            <p className="text-foreground/75">{issue.evidence}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/40">Impact</p>
            <p className="text-foreground/75">{issue.impact}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/40">Recommended fix</p>
            <p className="text-foreground/75">{issue.recommendation}</p>
          </div>
          {issue.relatedResourceUrls.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">Affected resources</p>
              <ul className="space-y-1">
                {issue.relatedResourceUrls.map((url) => (
                  <li key={url} className="truncate rounded bg-foreground/5 px-2 py-1 text-xs mono text-foreground/60">
                    {url}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
