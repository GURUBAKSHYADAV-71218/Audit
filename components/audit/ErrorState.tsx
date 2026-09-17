import { AlertTriangle, RotateCcw, ShieldOff, Clock, WifiOff, Ban, ServerCrash } from "lucide-react";
import type { AuditError } from "@/types/audit";
import { Logo } from "@/components/ui/Logo";

const ERROR_META: Record<AuditError["code"], { icon: typeof AlertTriangle; title: string }> = {
  invalid_url: { icon: AlertTriangle, title: "Invalid URL" },
  blocked_target: { icon: ShieldOff, title: "This target can't be scanned" },
  unreachable: { icon: WifiOff, title: "Website unreachable" },
  timeout: { icon: Clock, title: "The scan timed out" },
  browser_unavailable: { icon: ServerCrash, title: "Analysis engine unavailable" },
  scan_failed: { icon: AlertTriangle, title: "Scan failed" },
  rate_limited: { icon: Ban, title: "Too many scans" },
};

export function ErrorState({ error, onRetry }: { error: AuditError; onRetry: () => void }) {
  const meta = ERROR_META[error.code] ?? ERROR_META.scan_failed;
  const Icon = meta.icon;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <span className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/40">
        <Icon size={22} />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{meta.title}</h2>
      <p className="mt-2 text-sm text-foreground/55">{error.message}</p>
      <button
        onClick={onRetry}
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:scale-[1.02] transition-transform"
      >
        <RotateCcw size={15} /> Try again
      </button>
    </div>
  );
}
