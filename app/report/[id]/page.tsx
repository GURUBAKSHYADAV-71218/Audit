import Link from "next/link";
import { getResult } from "@/lib/store";
import { ReportPageClient } from "@/components/report/ReportPageClient";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getResult(id);

  if (!result) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">This report has expired</h1>
        <p className="mt-2 text-sm text-foreground/55">
          AUDIT keeps scan results for 30 minutes and doesn&rsquo;t store them permanently. Run a new scan to see fresh results.
        </p>
        <Link href="/" className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground">
          Run a new scan
        </Link>
      </div>
    );
  }

  return <ReportPageClient result={result} />;
}
