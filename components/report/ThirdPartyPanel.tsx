import type { ThirdPartyDomain } from "@/types/audit";
import { formatBytes, formatMs } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";

export function ThirdPartyPanel({ domains }: { domains: ThirdPartyDomain[] }) {
  if (domains.length === 0) {
    return (
      <div>
        <SectionHeading eyebrow="Network" title="Third-party impact" />
        <Card className="p-8 text-center text-foreground/60">No third-party domains were detected.</Card>
      </div>
    );
  }

  const totalBytes = domains.reduce((s, d) => s + d.transferredBytes, 0);

  return (
    <div>
      <SectionHeading
        eyebrow="Network"
        title="Third-party impact"
        description={`${domains.length} third-party domains added ${formatBytes(totalBytes)} to this page.`}
      />
      <Card className="divide-y divide-border-subtle">
        {domains.slice(0, 12).map((d) => (
          <div key={d.domain} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate font-medium mono text-sm">{d.domain}</p>
              <p className="text-xs capitalize text-foreground/45">{d.category}</p>
            </div>
            <div className="flex shrink-0 items-center gap-6 text-right">
              <div>
                <p className="text-sm font-medium">{d.requestCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-foreground/40">requests</p>
              </div>
              <div>
                <p className="text-sm font-medium">{formatBytes(d.transferredBytes)}</p>
                <p className="text-[10px] uppercase tracking-wide text-foreground/40">transferred</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{formatMs(d.durationMs)}</p>
                <p className="text-[10px] uppercase tracking-wide text-foreground/40">duration</p>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
