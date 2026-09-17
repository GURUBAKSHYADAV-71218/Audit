"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { StageId } from "@/types/audit";
import { STAGE_ORDER } from "@/lib/stages";
import { Logo } from "@/components/ui/Logo";

export interface StageState {
  stage: StageId;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
}

export function ScanProgress({ url, stages }: { url: string; stages: StageState[] }) {
  const doneCount = stages.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneCount / STAGE_ORDER.length) * 100);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <Logo />
      <p className="mt-6 text-sm text-foreground/50">Analyzing</p>
      <p className="mt-1 max-w-full truncate font-medium mono text-foreground">{url}</p>

      <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <ul className="mt-8 w-full space-y-2 text-left">
        <AnimatePresence initial={false}>
          {stages
            .filter((s) => s.status !== "pending")
            .map((s) => (
              <motion.li
                key={s.stage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              >
                {s.status === "done" ? (
                  <Check size={16} className="shrink-0 text-emerald-500" />
                ) : (
                  <Loader2 size={16} className="shrink-0 animate-spin text-accent" />
                )}
                <span className={s.status === "done" ? "text-foreground/70" : "font-medium text-foreground"}>{s.label}</span>
                {s.detail && <span className="ml-auto shrink-0 text-xs text-foreground/40 mono">{s.detail}</span>}
              </motion.li>
            ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export function initialStages(): StageState[] {
  return STAGE_ORDER.map((stage) => ({ stage, label: "", status: "pending" as const }));
}
