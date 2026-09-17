"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { WaterfallRequest, ResourceType } from "@/types/audit";
import { formatBytes, formatMs } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";

const FILTERS: { key: string; label: string; types: ResourceType[] }[] = [
  { key: "all", label: "All", types: [] },
  { key: "image", label: "Images", types: ["image"] },
  { key: "script", label: "JavaScript", types: ["script"] },
  { key: "stylesheet", label: "CSS", types: ["stylesheet"] },
  { key: "font", label: "Fonts", types: ["font"] },
  { key: "xhr", label: "XHR/Fetch", types: ["xhr", "fetch"] },
  { key: "other", label: "Other", types: ["document", "media", "other"] },
];

const TYPE_COLOR: Record<ResourceType, string> = {
  document: "bg-slate-500",
  script: "bg-amber-500",
  stylesheet: "bg-violet-500",
  image: "bg-emerald-500",
  font: "bg-pink-500",
  xhr: "bg-sky-500",
  fetch: "bg-sky-500",
  media: "bg-red-400",
  other: "bg-foreground/30",
};

export function Waterfall({ requests }: { requests: WaterfallRequest[] }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<WaterfallRequest | null>(null);

  const filtered = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    if (!active || active.types.length === 0) return requests;
    return requests.filter((r) => active.types.includes(r.type));
  }, [requests, filter]);

  const maxEnd = Math.max(...requests.map((r) => r.startMs + r.durationMs), 1);
  const shown = filtered.slice(0, 150);

  return (
    <div>
      <SectionHeading eyebrow="Network" title="Request waterfall" description="Each bar shows when a request started and how long it took." />
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "bg-accent text-accent-foreground" : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="thin-scroll max-h-[420px] overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            {shown.map((r, i) => (
              <button
                key={r.url + i}
                onClick={() => setSelected(r)}
                className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-foreground/5"
              >
                <span className="w-32 shrink-0 truncate text-xs mono text-foreground/60 sm:w-48">{r.shortName}</span>
                <div className="relative h-4 flex-1 rounded bg-foreground/5">
                  <div
                    className={clsx("absolute top-0 h-4 min-w-[2px] rounded", TYPE_COLOR[r.type])}
                    style={{
                      left: `${(r.startMs / maxEnd) * 100}%`,
                      width: `${Math.max(0.4, (r.durationMs / maxEnd) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-xs mono text-foreground/45">{formatMs(r.durationMs)}</span>
                <span className="hidden w-16 shrink-0 text-right text-xs mono text-foreground/45 sm:block">{formatBytes(r.sizeBytes)}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length > shown.length && (
          <p className="mt-3 text-center text-xs text-foreground/40">Showing first {shown.length} of {filtered.length} requests</p>
        )}
      </Card>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-5 shadow-xl"
          >
            <p className="mb-3 break-all text-sm font-medium mono">{selected.url}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Type" value={selected.type} />
              <Detail label="Status" value={String(selected.status)} />
              <Detail label="Size" value={formatBytes(selected.sizeBytes)} />
              <Detail label="Duration" value={formatMs(selected.durationMs)} />
              <Detail label="Started at" value={formatMs(selected.startMs)} />
              <Detail label="Party" value={selected.isFirstParty ? "First-party" : "Third-party"} />
            </dl>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full rounded-lg border border-border-subtle py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground/40">{label}</dt>
      <dd className="mono font-medium">{value}</dd>
    </div>
  );
}
