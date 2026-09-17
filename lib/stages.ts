import type { StageId } from "@/types/audit";

// Kept separate from lib/analyzer/index.ts (which imports Playwright and
// Node built-ins) so client components can safely import stage metadata
// without pulling server-only code into the browser bundle.

export const STAGE_ORDER: StageId[] = [
  "validate",
  "browser",
  "load",
  "network",
  "images",
  "javascript",
  "css",
  "fonts",
  "third-party",
  "diagnose",
];

const STAGE_LABELS: Record<StageId, string> = {
  validate: "URL validated",
  browser: "Browser initialized",
  load: "Page loaded",
  network: "Network requests captured",
  images: "Images analyzed",
  javascript: "JavaScript analyzed",
  css: "CSS analyzed",
  fonts: "Fonts analyzed",
  "third-party": "Third-party resources detected",
  diagnose: "Finding performance bottlenecks",
};

export function stageLabel(stage: StageId): string {
  return STAGE_LABELS[stage];
}
