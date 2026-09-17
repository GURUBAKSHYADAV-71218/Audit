import type { Issue, IssueCategory, CategoryScore, ScoreBreakdown, PerformanceMetrics } from "@/types/audit";

/**
 * AUDIT's scoring model — fully deterministic, no black box.
 *
 * Each category starts at 100 and loses points for every issue detected in
 * that category, weighted by severity. Categories are then combined into an
 * overall score using fixed weights that reflect how much each area
 * typically affects real-world load performance. A "loading" category score
 * is derived directly from measured Core Web Vitals rather than issues,
 * since that's the most direct signal of user-perceived speed.
 *
 * This is intentionally simple and transparent rather than a machine-learned
 * or opaque model — every point lost can be traced to a specific rule.
 */

const SEVERITY_PENALTY: Record<Issue["severity"], number> = {
  critical: 28,
  high: 18,
  medium: 10,
  low: 4,
};

const CATEGORY_WEIGHTS: Record<IssueCategory, number> = {
  loading: 0.22,
  images: 0.16,
  javascript: 0.18,
  css: 0.08,
  fonts: 0.06,
  network: 0.08,
  "third-party": 0.1,
  caching: 0.06,
  compression: 0.06,
};

function scoreLoadingFromMetrics(metrics: PerformanceMetrics): number {
  let score = 100;

  if (metrics.lcp.status !== "unavailable" && metrics.lcp.value !== null) {
    if (metrics.lcp.value > 4000) score -= 40;
    else if (metrics.lcp.value > 2500) score -= 20;
  }
  if (metrics.fcp.status !== "unavailable" && metrics.fcp.value !== null) {
    if (metrics.fcp.value > 3000) score -= 20;
    else if (metrics.fcp.value > 1800) score -= 10;
  }
  if (metrics.cls.status !== "unavailable" && metrics.cls.value !== null) {
    if (metrics.cls.value > 0.25) score -= 25;
    else if (metrics.cls.value > 0.1) score -= 12;
  }
  if (metrics.loadTimeMs > 8000) score -= 15;
  else if (metrics.loadTimeMs > 4000) score -= 8;

  return Math.max(0, Math.round(score));
}

export function calculateScore(issues: Issue[], metrics: PerformanceMetrics): ScoreBreakdown {
  const categories: IssueCategory[] = [
    "loading",
    "images",
    "javascript",
    "css",
    "fonts",
    "network",
    "third-party",
    "caching",
    "compression",
  ];

  const categoryScores: CategoryScore[] = categories.map((category) => {
    if (category === "loading") {
      return { category, score: scoreLoadingFromMetrics(metrics), weight: CATEGORY_WEIGHTS[category] };
    }
    const categoryIssues = issues.filter((i) => i.category === category);
    const penalty = categoryIssues.reduce((sum, issue) => sum + SEVERITY_PENALTY[issue.severity], 0);
    const score = Math.max(0, Math.round(100 - penalty));
    return { category, score, weight: CATEGORY_WEIGHTS[category] };
  });

  const overall = Math.round(
    categoryScores.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  return { overall: Math.min(100, Math.max(0, overall)), categories: categoryScores };
}
