import clsx from "clsx";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("rounded-2xl border border-border-subtle bg-surface", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-sm text-foreground/55">{description}</p>}
    </div>
  );
}

export function MetricBadge({ label }: { label: "measured" | "estimated" | "unavailable" }) {
  const map = {
    measured: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
    estimated: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
    unavailable: "text-foreground/40 bg-foreground/5",
  };
  return <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", map[label])}>{label}</span>;
}
