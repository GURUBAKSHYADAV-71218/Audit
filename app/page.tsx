"use client";

import { useCallback, useRef, useState } from "react";
import type { AuditError, AuditResult, Device } from "@/types/audit";
import { STAGE_ORDER, stageLabel } from "@/lib/stages";
import { streamAudit } from "@/lib/streamClient";
import { Hero } from "@/components/landing/Hero";
import { ExamplePreview } from "@/components/landing/ExamplePreview";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhatAuditChecks } from "@/components/landing/WhatAuditChecks";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { ScanProgress, type StageState } from "@/components/audit/ScanProgress";
import { ReportView } from "@/components/report/ReportView";
import { ErrorState } from "@/components/audit/ErrorState";

type ViewState =
  | { mode: "idle" }
  | { mode: "scanning"; url: string; stages: StageState[] }
  | { mode: "report"; result: AuditResult }
  | { mode: "error"; error: AuditError };

function freshStages(): StageState[] {
  return STAGE_ORDER.map((stage) => ({ stage, label: stageLabel(stage), status: "pending" as const }));
}

export default function Home() {
  const [state, setState] = useState<ViewState>({ mode: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const runScan = useCallback(async (url: string, device: Device) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ mode: "scanning", url, stages: freshStages() });

    try {
      await streamAudit(
        url,
        device,
        (event) => {
          if (event.type === "stage") {
            setState((prev) => {
              if (prev.mode !== "scanning") return prev;
              const stages = prev.stages.map((s) =>
                s.stage === event.stage ? { ...s, label: event.label, status: event.status, detail: event.detail } : s
              );
              return { ...prev, stages };
            });
          } else if (event.type === "result") {
            setState({ mode: "report", result: event.result });
            window.history.pushState({}, "", `/report/${event.result.id}`);
          } else if (event.type === "error") {
            setState({ mode: "error", error: event.error });
          }
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState({
        mode: "error",
        error: { code: "scan_failed", message: "Something went wrong while analyzing the page. Please try again." },
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    window.history.pushState({}, "", "/");
    setState({ mode: "idle" });
  }, []);

  if (state.mode === "scanning") {
    return <ScanProgress url={state.url} stages={state.stages} />;
  }

  if (state.mode === "report") {
    return <ReportView result={state.result} onRescan={reset} />;
  }

  if (state.mode === "error") {
    return <ErrorState error={state.error} onRetry={reset} />;
  }

  return (
    <div>
      <Hero onAnalyze={runScan} />
      <ExamplePreview />
      <HowItWorks />
      <WhatAuditChecks />
      <FinalCTA onAnalyze={runScan} />
    </div>
  );
}
