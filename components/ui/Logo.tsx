import { Gauge } from "lucide-react";
import clsx from "clsx";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const iconSize = size === "lg" ? 26 : size === "sm" ? 16 : 20;
  const iconBox = size === "lg" ? "h-9 w-9" : size === "sm" ? "h-6 w-6" : "h-7 w-7";

  return (
    <div className="inline-flex items-center gap-2">
      <span className={clsx("inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground", iconBox)}>
        <Gauge size={iconSize} strokeWidth={2.25} />
      </span>
      <span className={clsx("font-semibold tracking-tight mono", textSize)}>AUDIT</span>
    </div>
  );
}
