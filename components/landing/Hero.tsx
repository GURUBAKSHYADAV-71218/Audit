"use client";

import type { Device } from "@/types/audit";
import { URLForm } from "@/components/audit/URLForm";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Hero({ onAnalyze }: { onAnalyze: (url: string, device: Device) => void }) {
  return (
    <div>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center sm:pt-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">AUDIT</h1>
        <p className="mt-3 text-xl font-medium text-foreground/80 sm:text-2xl">Find what&rsquo;s slowing your website down.</p>
        <p className="mx-auto mt-4 max-w-xl text-balance text-foreground/55">
          Analyze your website&rsquo;s performance, uncover the resources causing delays, and get a prioritized list of fixes.
        </p>

        <div className="mt-10">
          <URLForm onSubmit={onAnalyze} />
        </div>

        <p className="mt-4 text-xs text-foreground/40">Real browser analysis · Resource diagnostics · Actionable fixes</p>
      </div>
    </div>
  );
}
