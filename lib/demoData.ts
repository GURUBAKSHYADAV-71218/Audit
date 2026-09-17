// Static, hand-authored example numbers for the landing-page preview only.
// Clearly labeled "Example Audit / Demo Data" wherever it's rendered, and
// never returned from the real /api/audit endpoint.

export const demoAudit = {
  url: "https://example-shop.com",
  score: 47,
  loadTimeMs: 4800,
  requests: 84,
  pageSizeMb: 6.2,
  topIssues: [
    { severity: "critical" as const, title: "Oversized hero image", detail: "hero-banner.png is 1.8 MB, rendered at 1/4 that size" },
    { severity: "high" as const, title: "Heavy JavaScript bundle", detail: "main.js is 1.3 MB and blocks rendering" },
    { severity: "medium" as const, title: "Uncompressed responses", detail: "HTML and CSS served without gzip/Brotli" },
  ],
  topContributors: [
    { label: "hero-banner.png", bytes: 1_800_000 },
    { label: "main.js", bytes: 1_300_000 },
    { label: "analytics.js (third-party)", bytes: 640_000 },
    { label: "fonts", bytes: 480_000 },
    { label: "styles.css", bytes: 310_000 },
  ],
};
