import { Laptop, Smartphone, RotateCcw } from "lucide-react";
import type { AuditResult } from "@/types/audit";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function ReportHeader({ result, onRescan }: { result: AuditResult; onRescan: () => void }) {
  const scannedAt = new Date(result.scannedAt);

  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <button
            onClick={onRescan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
          >
            <RotateCcw size={14} /> New scan
          </button>
          <ThemeToggle />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 pb-6">
        <p className="truncate text-2xl font-semibold tracking-tight mono">{result.finalUrl}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/50">
          <span>{scannedAt.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1">
            {result.device === "desktop" ? <Laptop size={13} /> : <Smartphone size={13} />}
            {result.device}
          </span>
          {result.finalUrl !== result.url && <span>Redirected from {result.url}</span>}
        </div>
        {result.warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
