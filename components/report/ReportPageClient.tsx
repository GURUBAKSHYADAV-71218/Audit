"use client";

import { useRouter } from "next/navigation";
import type { AuditResult } from "@/types/audit";
import { ReportView } from "@/components/report/ReportView";

export function ReportPageClient({ result }: { result: AuditResult }) {
  const router = useRouter();
  return <ReportView result={result} onRescan={() => router.push("/")} />;
}
