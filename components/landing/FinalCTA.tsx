"use client";

import type { Device } from "@/types/audit";
import { URLForm } from "@/components/audit/URLForm";

export function FinalCTA({ onAnalyze }: { onAnalyze: (url: string, device: Device) => void }) {
  return (
    <div className="border-t border-border-subtle bg-foreground/[0.02] px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to find what&rsquo;s slowing your site?</h2>
        <div className="mt-8">
          <URLForm onSubmit={onAnalyze} size="md" />
        </div>
      </div>
    </div>
  );
}
