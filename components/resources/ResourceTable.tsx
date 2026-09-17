"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import clsx from "clsx";
import type { Resource } from "@/types/audit";
import { formatBytes, formatMs, shortDomain } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";

type SortKey = "sizeBytes" | "durationMs" | "type" | "domain";

export function ResourceTable({ resources }: { resources: Resource[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sizeBytes");
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? resources.filter((r) => r.url.toLowerCase().includes(q) || r.type.includes(q)) : resources;
    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDesc ? -cmp : cmp;
    });
    return list;
  }, [resources, query, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <div>
      <SectionHeading eyebrow="Details" title="Resource explorer" description={`${resources.length} resources captured during the scan.`} />
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2">
          <Search size={15} className="text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by URL or type…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/35"
          />
        </div>

        <div className="thin-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs text-foreground/40">
                <th className="pb-2 pr-4 font-medium">Resource</th>
                <SortableHeader label="Type" active={sortKey === "type"} onClick={() => toggleSort("type")} />
                <SortableHeader label="Domain" active={sortKey === "domain"} onClick={() => toggleSort("domain")} />
                <th className="pb-2 pr-4 font-medium">Status</th>
                <SortableHeader label="Size" active={sortKey === "sizeBytes"} onClick={() => toggleSort("sizeBytes")} align="right" />
                <SortableHeader label="Duration" active={sortKey === "durationMs"} onClick={() => toggleSort("durationMs")} align="right" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r, i) => (
                <tr key={r.url + i} className="border-b border-border-subtle/60 last:border-0 hover:bg-foreground/[0.03]">
                  <td className="max-w-[220px] truncate py-2 pr-4 mono text-xs" title={r.url}>
                    {r.url.split("/").pop()?.split("?")[0] || r.url}
                  </td>
                  <td className="py-2 pr-4 text-xs capitalize text-foreground/60">{r.type}</td>
                  <td className="py-2 pr-4 text-xs text-foreground/60">
                    {shortDomain(r.url)}
                    {!r.isFirstParty && <span className="ml-1 rounded bg-foreground/10 px-1 py-0.5 text-[9px]">3P</span>}
                  </td>
                  <td className="py-2 pr-4 text-xs text-foreground/60">{r.status}</td>
                  <td className="py-2 pr-4 text-right text-xs mono font-medium">{formatBytes(r.sizeBytes)}</td>
                  <td className="py-2 pr-4 text-right text-xs mono text-foreground/60">{formatMs(r.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && (
          <p className="mt-3 text-center text-xs text-foreground/40">Showing first 200 of {filtered.length} matching resources</p>
        )}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-foreground/40">No resources match &ldquo;{query}&rdquo;.</p>}
      </Card>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={clsx("pb-2 pr-4 font-medium", align === "right" && "text-right")}>
      <button onClick={onClick} className={clsx("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}
        <ArrowUpDown size={11} />
      </button>
    </th>
  );
}
