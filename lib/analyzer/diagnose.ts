import type { Issue, Resource } from "@/types/audit";

const CATEGORY_LABEL: Record<string, string> = {
  images: "oversized images",
  javascript: "heavy JavaScript",
  css: "excess CSS",
  fonts: "font loading",
  network: "too many requests",
  "third-party": "third-party scripts",
  caching: "missing caching",
  compression: "missing compression",
  loading: "slow loading",
};

export function buildDiagnosis(
  issues: Issue[],
  resources: Resource[]
): { summary: string; topContributors: { label: string; bytes: number }[] } {
  // Weight categories by how many/severe their issues are, to find the 1-2
  // biggest culprits — mirrors how a human auditor would summarize findings.
  const severityWeight: Record<Issue["severity"], number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const categoryWeights = new Map<string, number>();
  for (const issue of issues) {
    categoryWeights.set(issue.category, (categoryWeights.get(issue.category) ?? 0) + severityWeight[issue.severity]);
  }

  const ranked = Array.from(categoryWeights.entries()).sort((a, b) => b[1] - a[1]);

  let summary: string;
  if (ranked.length === 0) {
    summary = "No major performance problems were detected. This page is in good shape.";
  } else if (ranked.length === 1) {
    summary = `Your page is primarily slowed by ${CATEGORY_LABEL[ranked[0][0]] ?? ranked[0][0]}.`;
  } else {
    const [first, second] = ranked;
    summary = `Your page is primarily slowed by ${CATEGORY_LABEL[first[0]] ?? first[0]} and ${
      CATEGORY_LABEL[second[0]] ?? second[0]
    }.`;
  }

  const topContributors = [...resources]
    .filter((r) => r.sizeBytes > 0)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 5)
    .map((r) => ({
      label: describeResource(r),
      bytes: r.sizeBytes,
    }));

  return { summary, topContributors };
}

function describeResource(r: Resource): string {
  const name = r.url.split("/").pop()?.split("?")[0] || r.domain;
  if (!r.isFirstParty) {
    const kind = r.type === "script" ? "script" : r.type === "xhr" || r.type === "fetch" ? "request" : r.type;
    return `${name || r.domain} (third-party ${kind})`;
  }
  return name;
}
