// Core domain types for AUDIT. Kept in one file deliberately — this is a
// small, cohesive domain model, not a large system that benefits from
// splitting types across many files.

export type Device = "desktop" | "mobile";

export type ResourceType =
  | "document"
  | "script"
  | "stylesheet"
  | "image"
  | "font"
  | "xhr"
  | "fetch"
  | "media"
  | "other";

export type MetricStatus = "measured" | "estimated" | "unavailable";

export interface Resource {
  url: string;
  domain: string;
  type: ResourceType;
  mimeType: string;
  status: number;
  sizeBytes: number; // encoded/transferred size when available
  transferredBytes: number | null; // null if unavailable (e.g. cached, opaque)
  durationMs: number;
  startMs: number;
  isFirstParty: boolean;
  cacheControl: string | null;
  etag: string | null;
  lastModified: string | null;
  contentEncoding: string | null; // gzip / br / null
}

export interface ImageResource extends Resource {
  type: "image";
  format: string | null; // avif, webp, png, jpeg, svg, gif, unknown
  intrinsicWidth: number | null;
  intrinsicHeight: number | null;
  renderedWidth: number | null;
  renderedHeight: number | null;
  isOversized: boolean; // intrinsic significantly larger than rendered
  hasLazyLoading: boolean;
}

export interface ScriptResource extends Resource {
  type: "script";
  isAsync: boolean;
  isDefer: boolean;
  isModule: boolean;
  isRenderBlocking: boolean;
}

export interface StylesheetResource extends Resource {
  type: "stylesheet";
  isRenderBlocking: boolean;
}

export interface FontResource extends Resource {
  type: "font";
  format: string | null; // woff2, woff, ttf, otf, eot
  isPreloaded: boolean;
}

export type MetricValue =
  | { status: "measured"; value: number }
  | { status: "estimated"; value: number }
  | { status: "unavailable"; value: null };

export interface PerformanceMetrics {
  fcp: MetricValue; // ms
  lcp: MetricValue; // ms
  cls: MetricValue; // unitless
  inp: MetricValue; // ms (approximate — real INP needs real user interaction)
  tbt: MetricValue; // ms
  loadTimeMs: number; // window load event, always measured
  domContentLoadedMs: number;
  ttfbMs: MetricValue;
}

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type IssueCategory =
  | "images"
  | "javascript"
  | "css"
  | "fonts"
  | "network"
  | "third-party"
  | "caching"
  | "compression"
  | "loading";

export interface Issue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  evidence: string;
  impact: string;
  recommendation: string;
  potentialSavingsBytes?: number;
  potentialSavingsMs?: number;
  relatedResourceUrls: string[];
}

export interface ThirdPartyDomain {
  domain: string;
  category: "analytics" | "advertising" | "social" | "chat" | "cdn" | "font" | "other";
  requestCount: number;
  transferredBytes: number;
  durationMs: number;
}

export interface WaterfallRequest {
  url: string;
  shortName: string;
  type: ResourceType;
  startMs: number;
  durationMs: number;
  sizeBytes: number;
  status: number;
  isFirstParty: boolean;
}

export interface CategoryScore {
  category: IssueCategory;
  score: number; // 0-100
  weight: number; // fraction of overall score
}

export interface ScoreBreakdown {
  overall: number; // 0-100
  categories: CategoryScore[];
}

export interface TechDetection {
  name: string;
  category: "framework" | "cms" | "hosting" | "cdn" | "analytics" | "ecommerce";
  confidence: "high" | "medium";
}

export interface AuditResult {
  id: string;
  url: string;
  finalUrl: string;
  device: Device;
  scannedAt: string; // ISO timestamp
  score: ScoreBreakdown;
  metrics: PerformanceMetrics;
  pageSizeBytes: number;
  requestCount: number;
  diagnosis: {
    summary: string;
    topContributors: { label: string; bytes: number }[];
  };
  issues: Issue[];
  resources: Resource[];
  images: ImageResource[];
  scripts: ScriptResource[];
  stylesheets: StylesheetResource[];
  fonts: FontResource[];
  thirdParty: ThirdPartyDomain[];
  waterfall: WaterfallRequest[];
  technologies: TechDetection[];
  warnings: string[]; // non-fatal notes, e.g. "CLS unavailable for this page"
}

export interface AuditError {
  code:
    | "invalid_url"
    | "blocked_target"
    | "unreachable"
    | "timeout"
    | "browser_unavailable"
    | "scan_failed"
    | "rate_limited";
  message: string;
}

export type StageId =
  | "validate"
  | "browser"
  | "load"
  | "network"
  | "images"
  | "javascript"
  | "css"
  | "fonts"
  | "third-party"
  | "diagnose";

export interface StageEvent {
  type: "stage";
  stage: StageId;
  label: string;
  status: "active" | "done";
  detail?: string;
}

export interface ResultEvent {
  type: "result";
  result: AuditResult;
}

export interface ErrorEvent {
  type: "error";
  error: AuditError;
}

export type AuditStreamEvent = StageEvent | ResultEvent | ErrorEvent;
