import { nanoid } from "nanoid";
import {
  runBrowserScan,
  ScanTimeoutError,
  ScanUnreachableError,
  BrowserUnavailableError,
} from "@/lib/analyzer/browser";
import { isSameSite, categorizeThirdParty } from "@/lib/analyzer/classify";
import { calculateScore } from "@/lib/scoring";
import {
  detectImageIssues,
  detectJavaScriptIssues,
  detectCssIssues,
  detectFontIssues,
  detectThirdPartyIssues,
  detectCachingIssues,
  detectCompressionIssues,
  detectNetworkIssues,
  prioritizeIssues,
} from "@/lib/recommendations";
import { buildDiagnosis } from "@/lib/analyzer/diagnose";
import { stageLabel } from "@/lib/stages";
import type {
  AuditResult,
  AuditError,
  Device,
  ThirdPartyDomain,
  WaterfallRequest,
  StageId,
} from "@/types/audit";

export type AuditOutcome = { ok: true; result: AuditResult } | { ok: false; error: AuditError };

export { stageLabel };

/**
 * Runs a complete audit against an already-validated URL. Emits real stage
 * progress via `onStage` as each phase genuinely completes — nothing here is
 * simulated or time-based.
 */
export async function runAudit(
  targetUrl: URL,
  device: Device,
  onStage?: (stage: StageId, status: "active" | "done", detail?: string) => void
): Promise<AuditOutcome> {
  onStage?.("validate", "done");
  onStage?.("browser", "active");

  let raw;
  try {
    raw = await runBrowserScan(targetUrl, device, (stage, detail) => {
      if (stage === "browser") onStage?.("browser", "done", detail);
      if (stage === "load") onStage?.("load", "active", detail);
      if (stage === "network") {
        onStage?.("load", "done");
        onStage?.("network", "done", detail);
      }
    });
  } catch (err) {
    if (err instanceof ScanTimeoutError) {
      return { ok: false, error: { code: "timeout", message: err.message } };
    }
    if (err instanceof ScanUnreachableError) {
      return { ok: false, error: { code: "unreachable", message: err.message } };
    }
    if (err instanceof BrowserUnavailableError) {
      // err.message is already a clean, user-safe string set in browser.ts —
      // it differs depending on *where* startup failed (module missing,
      // executable resolution, or launch) and whether we're on a managed
      // serverless deployment or local dev, which is more useful to the
      // person hitting the error than one generic sentence.
      return { ok: false, error: { code: "browser_unavailable", message: err.message } };
    }
    return {
      ok: false,
      error: { code: "scan_failed", message: "Something went wrong while analyzing the page. Please try again." },
    };
  }

  onStage?.("images", "active");
  const imageIssues = detectImageIssues(raw.images);
  onStage?.("images", "done", `${raw.images.length} images`);

  onStage?.("javascript", "active");
  const jsIssues = detectJavaScriptIssues(raw.scripts);
  onStage?.("javascript", "done", `${raw.scripts.length} scripts`);

  onStage?.("css", "active");
  const cssIssues = detectCssIssues(raw.stylesheets);
  onStage?.("css", "done", `${raw.stylesheets.length} stylesheets`);

  onStage?.("fonts", "active");
  const fontIssues = detectFontIssues(raw.fonts);
  onStage?.("fonts", "done", `${raw.fonts.length} fonts`);

  onStage?.("third-party", "active");
  const finalHost = new URL(raw.finalUrl).hostname;
  const thirdPartyMap = new Map<string, ThirdPartyDomain>();
  for (const resource of raw.resources) {
    if (isSameSite(resource.domain, finalHost)) continue;
    const existing = thirdPartyMap.get(resource.domain);
    if (existing) {
      existing.requestCount += 1;
      existing.transferredBytes += resource.sizeBytes;
      existing.durationMs += resource.durationMs;
    } else {
      thirdPartyMap.set(resource.domain, {
        domain: resource.domain,
        category: categorizeThirdParty(resource.domain),
        requestCount: 1,
        transferredBytes: resource.sizeBytes,
        durationMs: resource.durationMs,
      });
    }
  }
  const thirdParty = Array.from(thirdPartyMap.values()).sort((a, b) => b.transferredBytes - a.transferredBytes);
  const thirdPartyIssues = detectThirdPartyIssues(thirdParty);
  onStage?.("third-party", "done", `${thirdParty.length} domains`);

  onStage?.("diagnose", "active");
  const cachingIssues = detectCachingIssues(raw.resources);
  const compressionIssues = detectCompressionIssues(raw.resources);
  const networkIssues = detectNetworkIssues(raw.resources, raw.resources.length);

  const allIssues = prioritizeIssues([
    ...imageIssues,
    ...jsIssues,
    ...cssIssues,
    ...fontIssues,
    ...thirdPartyIssues,
    ...cachingIssues,
    ...compressionIssues,
    ...networkIssues,
  ]);

  const score = calculateScore(allIssues, raw.metrics);
  const diagnosis = buildDiagnosis(allIssues, raw.resources);

  const waterfall: WaterfallRequest[] = raw.resources
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map((r) => ({
      url: r.url,
      shortName: r.url.split("/").pop()?.split("?")[0] || r.domain,
      type: r.type,
      startMs: r.startMs,
      durationMs: r.durationMs,
      sizeBytes: r.sizeBytes,
      status: r.status,
      isFirstParty: r.isFirstParty,
    }));

  const pageSizeBytes = raw.resources.reduce((s, r) => s + r.sizeBytes, 0);

  const result: AuditResult = {
    id: nanoid(12),
    url: targetUrl.toString(),
    finalUrl: raw.finalUrl,
    device,
    scannedAt: new Date().toISOString(),
    score,
    metrics: raw.metrics,
    pageSizeBytes,
    requestCount: raw.resources.length,
    diagnosis,
    issues: allIssues,
    resources: raw.resources,
    images: raw.images,
    scripts: raw.scripts,
    stylesheets: raw.stylesheets,
    fonts: raw.fonts,
    thirdParty,
    waterfall,
    technologies: raw.technologies,
    warnings: raw.warnings,
  };

  onStage?.("diagnose", "done", `${allIssues.length} issues found`);

  return { ok: true, result };
}
