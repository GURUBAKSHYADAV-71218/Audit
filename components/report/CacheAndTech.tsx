import type { Resource, TechDetection } from "@/types/audit";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ShieldCheck, ShieldAlert, Layers } from "lucide-react";

export function CacheAndCompression({ resources }: { resources: Resource[] }) {
  const staticTypes = new Set(["image", "script", "stylesheet", "font"]);
  const cacheable = resources.filter((r) => staticTypes.has(r.type) && r.status === 200);
  const cached = cacheable.filter((r) => !!r.cacheControl);

  const textTypes = new Set(["document", "script", "stylesheet", "xhr", "fetch"]);
  const compressible = resources.filter((r) => textTypes.has(r.type) && r.status === 200 && r.sizeBytes > 1000);
  const compressed = compressible.filter((r) => r.contentEncoding && r.contentEncoding !== "identity");

  return (
    <div>
      <SectionHeading eyebrow="Delivery" title="Cache & compression" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatusCard
          icon={cached.length === cacheable.length ? ShieldCheck : ShieldAlert}
          good={cacheable.length > 0 && cached.length === cacheable.length}
          title="Caching"
          value={cacheable.length > 0 ? `${cached.length} / ${cacheable.length}` : "—"}
          description="static assets with a Cache-Control header"
        />
        <StatusCard
          icon={compressed.length === compressible.length ? ShieldCheck : ShieldAlert}
          good={compressible.length > 0 && compressed.length === compressible.length}
          title="Compression"
          value={compressible.length > 0 ? `${compressed.length} / ${compressible.length}` : "—"}
          description="text responses served compressed"
        />
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  good,
  title,
  value,
  description,
}: {
  icon: typeof ShieldCheck;
  good: boolean;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          good ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        }`}
      >
        <Icon size={18} />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-2xl font-semibold mono">{value}</p>
        <p className="text-xs text-foreground/45">{description}</p>
      </div>
    </Card>
  );
}

export function TechStack({ technologies }: { technologies: TechDetection[] }) {
  if (technologies.length === 0) return null;
  return (
    <div>
      <SectionHeading eyebrow="Detected" title="Technology" description="Best-effort detection from response headers and page markup." />
      <Card className="flex flex-wrap gap-2 p-5">
        {technologies.map((t) => (
          <span
            key={t.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-sm"
          >
            <Layers size={13} className="text-foreground/40" />
            {t.name}
            {t.confidence === "medium" && <span className="text-[10px] text-foreground/35">?</span>}
          </span>
        ))}
      </Card>
    </div>
  );
}
