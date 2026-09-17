import dns from "node:dns/promises";
import net from "node:net";
import type { Browser, Page, Response as PWResponse } from "playwright-core";
import { isBlockedResolvedIp } from "@/lib/security/ssrf";
import { classifyResourceType, getImageFormat, getFontFormat } from "@/lib/analyzer/classify";
import type {
  Device,
  Resource,
  ImageResource,
  ScriptResource,
  StylesheetResource,
  FontResource,
  PerformanceMetrics,
  TechDetection,
} from "@/types/audit";

// Vercel Functions allow up to 60s execution on Hobby (with maxDuration
// explicitly configured — see app/api/audit/route.ts and vercel.json) and
// considerably more on Pro. These internal budgets stay comfortably under
// that ceiling so the function has time to stream its response and clean up
// even in the worst case, rather than being killed mid-scan by the platform.
const NAV_TIMEOUT_MS = 20_000;
const OVERALL_TIMEOUT_MS = 42_000;
const NETWORK_IDLE_WAIT_MS = 5_000;
const MAX_TRACKED_RESOURCES = 400;

/** Minimal, structured, non-sensitive diagnostics for the browser lifecycle.
 * Never logs cookies, headers, secrets, or full page content — just enough
 * to tell, from Vercel's function logs, which stage a failed scan died in. */
function log(tag: string, detail?: Record<string, string | number | boolean | undefined>) {
  const suffix = detail
    ? " " + Object.entries(detail).map(([k, v]) => `${k}=${v}`).join(" ")
    : "";
  console.log(`[audit] ${tag}${suffix}`);
}

const DEVICE_PROFILES: Record<Device, { viewport: { width: number; height: number }; userAgent: string; deviceScaleFactor: number }> = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AUDIT/1.0",
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1 AUDIT/1.0",
  },
};

// Injected before any page script runs so we can capture LCP/CLS/FCP the
// same way real-user-monitoring tools do, via PerformanceObserver. Playwright
// exposes the result back to Node through page.evaluate() after load.
const PERFORMANCE_COLLECTOR_SCRIPT = `
window.__auditMetrics = { lcp: 0, cls: 0, fcpEntries: [], clsEntries: [] };
try {
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) window.__auditMetrics.lcp = last.renderTime || last.loadTime || 0;
  }).observe({ type: "largest-contentful-paint", buffered: true });
} catch (e) {}
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.__auditMetrics.cls = (window.__auditMetrics.cls || 0) + entry.value;
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
} catch (e) {}
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === "first-contentful-paint") {
        window.__auditMetrics.fcpEntries.push(entry.startTime);
      }
    }
  }).observe({ type: "paint", buffered: true });
} catch (e) {}
`;

export interface RawScanData {
  finalUrl: string;
  resources: Resource[];
  images: ImageResource[];
  scripts: ScriptResource[];
  stylesheets: StylesheetResource[];
  fonts: FontResource[];
  metrics: PerformanceMetrics;
  technologies: TechDetection[];
  warnings: string[];
}

export class ScanTimeoutError extends Error {}
export class ScanUnreachableError extends Error {}
export class BrowserUnavailableError extends Error {}

/**
 * True when running as a Vercel Function (also true for local `vercel dev`).
 * Vercel sets this automatically — no manual configuration required. We also
 * check the generic AWS Lambda marker so the same code path works if this
 * project is ever deployed straight to Lambda instead of through Vercel.
 */
function isManagedServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * The pinned @sparticuz/chromium-min version installed in package.json.
 * MUST be kept in sync with the version there — the remote pack URL below
 * is version-specific, and chromium-min validates that the downloaded pack
 * matches what the installed package expects.
 */
const SPARTICUZ_VERSION = "153.0.0";

/**
 * Where the actual Chromium binary is fetched from at cold start.
 *
 * We deliberately use @sparticuz/chromium-min (not the full @sparticuz/chromium)
 * for the Vercel deployment. The full package bundles the ~65MB Chromium
 * binary as local .br files and expects Next.js's Output File Tracing to
 * carry them into the deployed function. That tracing path only follows
 * static `import`/`require()` calls — @sparticuz/chromium reads its own
 * binaries via a dynamic relative-path fs read, not a static require, so
 * the tracer has nothing to follow and can silently drop the bin/ directory
 * from the deployment even with `outputFileTracingIncludes` configured.
 * This is a known, currently-open issue specifically affecting Next.js
 * App Router + Turbopack builds on Vercel (matches the exact
 * "input directory .../bin does not exist" failure this project hit).
 *
 * @sparticuz/chromium-min ships with NO local binary at all (its package
 * is ~80KB), so there is nothing for the bundler or the tracer to lose.
 * Instead it downloads a versioned "pack" tarball over HTTPS on cold start
 * and extracts it to /tmp — a strategy that does not depend on Next.js's
 * file-tracing behavior at all. This is the officially documented fallback
 * from the package's own README for exactly this failure mode.
 *
 * The default URL points at the Sparticuz project's own GitHub Release
 * asset for this exact version (no infrastructure of ours required). It
 * can be overridden with CHROMIUM_PACK_URL — e.g. to self-host the same
 * .tar file somewhere closer to your Vercel region — but no configuration
 * is required for a working deployment.
 */
function chromiumPackUrl(): string {
  return (
    process.env.CHROMIUM_PACK_URL ||
    `https://github.com/Sparticuz/chromium/releases/download/v${SPARTICUZ_VERSION}/chromium-v${SPARTICUZ_VERSION}-pack.x64.tar`
  );
}

async function launchBrowser(): Promise<Browser> {
  log("AUDIT_BROWSER_START", { serverless: isManagedServerless(), platform: process.platform });

  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (err) {
    log("AUDIT_BROWSER_MODULE_MISSING", { error: err instanceof Error ? err.message : String(err) });
    throw new BrowserUnavailableError("The analysis engine's browser driver is not installed on this server.");
  }

  let executablePath: string | undefined;
  let extraArgs: string[] = [];

  if (isManagedServerless()) {
    // Production path: fetch (or reuse, if this container is warm) a
    // serverless-optimized Chromium build and extract it to /tmp. See the
    // chromiumPackUrl() comment above for why -min + a remote pack is used
    // instead of the full @sparticuz/chromium package.
    try {
      const sparticuz = (await import("@sparticuz/chromium-min")).default;
      const packUrl = chromiumPackUrl();
      log("AUDIT_BROWSER_FETCHING_PACK", { packUrl });
      executablePath = await sparticuz.executablePath(packUrl);
      extraArgs = sparticuz.args;
      log("AUDIT_BROWSER_EXECUTABLE_RESOLVED", { executablePath });
    } catch (err) {
      log("AUDIT_BROWSER_EXECUTABLE_RESOLUTION_FAILED", { error: err instanceof Error ? err.message : String(err) });
      throw new BrowserUnavailableError(
        "The analysis engine's browser could not be prepared on this server. See the README for Vercel deployment requirements."
      );
    }
  } else {
    // Local development path: use whatever Chromium `npx playwright
    // install chromium` downloaded to playwright-core's local browser
    // cache. An explicit override is honored too, for anyone running a
    // custom/self-hosted browser.
    executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  }

  // NOTE: we deliberately do NOT pass a custom --user-data-dir here.
  // Playwright's browserType.launch() manages its own temporary profile
  // directory internally and removes it on browser.close() (verified: passing
  // --user-data-dir via `args` makes Playwright throw
  // "Pass userDataDir parameter to launchPersistentContext() instead" — that
  // API is only for launchPersistentContext, which is not the model this
  // analyzer uses since each scan gets its own fresh browser + context).
  const mergedArgs = Array.from(
    new Set([...extraArgs, "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions", "--disable-background-networking"])
  );

  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: mergedArgs,
      timeout: 15_000,
    });
    log("AUDIT_BROWSER_LAUNCHED");
    return browser;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("AUDIT_BROWSER_LAUNCH_FAILED", { error: message });
    throw new BrowserUnavailableError(
      isManagedServerless()
        ? "The analysis engine's browser failed to start on this server."
        : "The browser could not be launched locally. Run `npx playwright install chromium` and try again."
    );
  }
}

/**
 * Runs a real Playwright scan against `url` and returns raw captured data.
 * Deterministic scoring/issue-detection happens later, in lib/analyzer/index.ts —
 * this module's only job is to faithfully capture what actually happened.
 */
export async function runBrowserScan(
  targetUrl: URL,
  device: Device,
  onStage?: (stage: string, detail?: string) => void
): Promise<RawScanData> {
  const overallDeadline = Date.now() + OVERALL_TIMEOUT_MS;
  const browser = await launchBrowser();
  onStage?.("browser");

  const warnings: string[] = [];
  const profile = DEVICE_PROFILES[device];

  try {
    let context;
    try {
      context = await browser.newContext({
        viewport: profile.viewport,
        userAgent: profile.userAgent,
        deviceScaleFactor: profile.deviceScaleFactor,
        javaScriptEnabled: true,
        // Real websites, not authenticated dashboards — no storage state needed.
      });
    } catch (err) {
      log("AUDIT_PAGE_CREATION_FAILED", { error: err instanceof Error ? err.message : String(err) });
      throw new BrowserUnavailableError("Could not create a browser session on this server.");
    }
    context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    context.setDefaultTimeout(NAV_TIMEOUT_MS);

    const page = await context.newPage();
    await page.addInitScript(PERFORMANCE_COLLECTOR_SCRIPT);

    // Re-validate every navigation/subresource host against the SSRF
    // blocklist as requests happen, so redirects to internal targets are
    // blocked even though Playwright itself would happily follow them.
    await page.route("**/*", async (route) => {
      const reqUrl = new URL(route.request().url());
      if (reqUrl.protocol !== "http:" && reqUrl.protocol !== "https:") {
        return route.abort();
      }
      const hostname = reqUrl.hostname;
      if (net.isIP(hostname)) {
        if (isBlockedResolvedIp(hostname)) return route.abort();
        return route.continue();
      }
      try {
        const records = await dns.lookup(hostname, { all: true });
        if (records.some((r) => isBlockedResolvedIp(r.address))) {
          return route.abort();
        }
      } catch {
        // If DNS fails here, let the browser's own navigation surface the
        // error naturally rather than us guessing.
      }
      return route.continue();
    });

    const responses: { response: PWResponse; startMs: number }[] = [];
    const navStart = Date.now();

    page.on("response", (response) => {
      if (responses.length < MAX_TRACKED_RESOURCES) {
        responses.push({ response, startMs: Date.now() - navStart });
      }
    });

    onStage?.("load", `Loading ${targetUrl.toString()}`);
    log("AUDIT_PAGE_NAVIGATION_START");

    let mainResponse: PWResponse | null;
    try {
      mainResponse = await page.goto(targetUrl.toString(), {
        waitUntil: "load",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("AUDIT_PAGE_NAVIGATION_FAILED", { error: msg });
      if (msg.toLowerCase().includes("timeout")) {
        throw new ScanTimeoutError("The page took too long to load.");
      }
      throw new ScanUnreachableError("The website could not be reached.");
    }

    if (!mainResponse) {
      log("AUDIT_PAGE_NAVIGATION_FAILED", { error: "no response" });
      throw new ScanUnreachableError("The website could not be reached.");
    }
    log("AUDIT_PAGE_NAVIGATION_COMPLETE", { status: mainResponse.status() });

    // Give in-flight late resources / JS-driven layout a brief moment to
    // settle so CLS and lazy-loaded content are captured, without holding
    // up the whole scan indefinitely.
    const remaining = Math.max(0, overallDeadline - Date.now());
    await page
      .waitForLoadState("networkidle", { timeout: Math.min(NETWORK_IDLE_WAIT_MS, remaining) })
      .catch(() => {
        warnings.push("The page kept loading network activity after load — some late resources may be missing.");
      });

    onStage?.("network", `${responses.length} requests captured`);

    // ---- Timing metrics ----
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const collected = (window as unknown as { __auditMetrics?: { lcp: number; cls: number; fcpEntries: number[] } }).__auditMetrics;
      return {
        domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : 0,
        loadMs: nav ? nav.loadEventEnd : 0,
        ttfbMs: nav ? nav.responseStart - nav.requestStart : null,
        lcp: collected?.lcp ?? 0,
        cls: collected?.cls ?? 0,
        fcp: collected?.fcpEntries?.[0] ?? null,
      };
    });

    // ---- Technology detection (best-effort, never blocks the scan) ----
    const technologies = await detectTechnologies(page, mainResponse).catch(() => []);

    // ---- Build resource list from captured responses ----
    const resources: Resource[] = [];
    const images: ImageResource[] = [];
    const scripts: ScriptResource[] = [];
    const stylesheets: StylesheetResource[] = [];
    const fonts: FontResource[] = [];

    const finalUrl = page.url();
    const finalHost = new URL(finalUrl).hostname;

    // Pull rendered/intrinsic image dimensions from the DOM in one pass.
    const domImageInfo = await page
      .evaluate(() => {
        const out: Record<string, { naturalWidth: number; naturalHeight: number; width: number; height: number; loading: string | null }> = {};
        document.querySelectorAll("img").forEach((img) => {
          const el = img as HTMLImageElement;
          if (!el.currentSrc) return;
          out[el.currentSrc] = {
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            width: el.width,
            height: el.height,
            loading: el.getAttribute("loading"),
          };
        });
        return out;
      })
      .catch(() => ({}) as Record<string, { naturalWidth: number; naturalHeight: number; width: number; height: number; loading: string | null }>);

    const domScriptInfo = await page
      .evaluate(() => {
        const out: Record<string, { async: boolean; defer: boolean; type: string }> = {};
        document.querySelectorAll("script[src]").forEach((s) => {
          const el = s as HTMLScriptElement;
          out[el.src] = { async: el.async, defer: el.defer, type: el.type || "" };
        });
        return out;
      })
      .catch(() => ({}) as Record<string, { async: boolean; defer: boolean; type: string }>);

    const domFontInfo = await page
      .evaluate(() => {
        const preloaded = new Set<string>();
        document.querySelectorAll('link[rel="preload"][as="font"]').forEach((l) => {
          const href = (l as HTMLLinkElement).href;
          if (href) preloaded.add(href);
        });
        return Array.from(preloaded);
      })
      .catch(() => [] as string[]);

    for (const { response, startMs } of responses) {
      let url: URL;
      try {
        url = new URL(response.url());
      } catch {
        continue;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;

      const headers = response.headers();
      const mimeType = (headers["content-type"] || "").split(";")[0].trim();
      const contentLength = headers["content-length"] ? Number(headers["content-length"]) : null;
      const request = response.request();
      const timingInfo = request.timing();
      const durationMs =
        timingInfo && timingInfo.responseEnd >= 0 ? Math.max(0, timingInfo.responseEnd - timingInfo.requestStart) : 0;

      let sizeBytes = contentLength ?? 0;
      const transferredBytes: number | null = contentLength;
      try {
        const sizes = await response.body().then(
          (buf) => buf.length,
          () => null
        );
        if (sizes !== null) sizeBytes = sizes;
      } catch {
        // Body unavailable (redirect, opaque, media stream) — fall back to header.
      }

      const type = classifyResourceType(request.resourceType(), url.toString(), mimeType);
      const isFirstParty = url.hostname === finalHost || url.hostname.endsWith(`.${finalHost.split(".").slice(-2).join(".")}`);

      const base: Resource = {
        url: url.toString(),
        domain: url.hostname,
        type,
        mimeType,
        status: response.status(),
        sizeBytes,
        transferredBytes,
        durationMs,
        startMs,
        isFirstParty,
        cacheControl: headers["cache-control"] ?? null,
        etag: headers["etag"] ?? null,
        lastModified: headers["last-modified"] ?? null,
        contentEncoding: headers["content-encoding"] ?? null,
      };

      resources.push(base);

      if (type === "image") {
        const domInfo = domImageInfo[url.toString()];
        const intrinsicW = domInfo?.naturalWidth || null;
        const intrinsicH = domInfo?.naturalHeight || null;
        const renderedW = domInfo?.width || null;
        const renderedH = domInfo?.height || null;
        const isOversized =
          !!intrinsicW && !!renderedW && intrinsicW > renderedW * 1.8 && intrinsicW > 200;
        images.push({
          ...base,
          type: "image",
          format: getImageFormat(url.toString(), mimeType),
          intrinsicWidth: intrinsicW,
          intrinsicHeight: intrinsicH,
          renderedWidth: renderedW,
          renderedHeight: renderedH,
          isOversized,
          hasLazyLoading: domInfo?.loading === "lazy",
        });
      } else if (type === "script") {
        const domInfo = domScriptInfo[url.toString()];
        scripts.push({
          ...base,
          type: "script",
          isAsync: !!domInfo?.async,
          isDefer: !!domInfo?.defer,
          isModule: domInfo?.type === "module",
          isRenderBlocking: !domInfo || (!domInfo.async && !domInfo.defer && domInfo.type !== "module"),
        });
      } else if (type === "stylesheet") {
        stylesheets.push({
          ...base,
          type: "stylesheet",
          isRenderBlocking: true, // link[rel=stylesheet] without media query is blocking by default
        });
      } else if (type === "font") {
        fonts.push({
          ...base,
          type: "font",
          format: getFontFormat(url.toString(), mimeType),
          isPreloaded: domFontInfo.includes(url.toString()),
        });
      }
    }

    const metrics: PerformanceMetrics = {
      fcp: timing.fcp != null ? { status: "measured", value: timing.fcp } : { status: "unavailable", value: null },
      lcp: timing.lcp > 0 ? { status: "measured", value: timing.lcp } : { status: "unavailable", value: null },
      cls: { status: "measured", value: Number(timing.cls?.toFixed(4) ?? 0) },
      inp: { status: "unavailable", value: null }, // real INP requires actual user interaction
      tbt: { status: "unavailable", value: null }, // requires long-task attribution beyond this MVP's scope
      loadTimeMs: timing.loadMs || Date.now() - navStart,
      domContentLoadedMs: timing.domContentLoadedMs || 0,
      ttfbMs: timing.ttfbMs != null && timing.ttfbMs >= 0 ? { status: "measured", value: timing.ttfbMs } : { status: "unavailable", value: null },
    };

    await context.close();
    log("AUDIT_BROWSER_CLOSED");

    return { finalUrl, resources, images, scripts, stylesheets, fonts, metrics, technologies, warnings };
  } finally {
    await browser.close().catch((err) => {
      log("AUDIT_BROWSER_CLOSE_FAILED", { error: err instanceof Error ? err.message : String(err) });
    });
  }
}

async function detectTechnologies(page: Page, mainResponse: PWResponse): Promise<TechDetection[]> {
  const found: TechDetection[] = [];
  const headers = mainResponse.headers();

  const server = (headers["server"] || "").toLowerCase();
  const poweredBy = (headers["x-powered-by"] || "").toLowerCase();

  if (headers["x-vercel-id"]) found.push({ name: "Vercel", category: "hosting", confidence: "high" });
  if (server.includes("cloudflare") || headers["cf-ray"]) found.push({ name: "Cloudflare", category: "cdn", confidence: "high" });
  if (poweredBy.includes("next.js") || headers["x-nextjs-cache"]) found.push({ name: "Next.js", category: "framework", confidence: "high" });
  if (headers["x-shopify-stage"] || server.includes("shopify")) found.push({ name: "Shopify", category: "ecommerce", confidence: "high" });

  const html = await page.content().catch(() => "");
  const check = (pattern: RegExp, name: string, category: TechDetection["category"], confidence: TechDetection["confidence"] = "medium") => {
    if (pattern.test(html) && !found.some((f) => f.name === name)) {
      found.push({ name, category, confidence });
    }
  };

  check(/__next_f|_next\/static/, "Next.js", "framework", "high");
  check(/data-reactroot|react-dom/, "React", "framework");
  check(/__nuxt|_nuxt\//, "Nuxt", "framework", "high");
  check(/data-v-app|__vue__/, "Vue", "framework");
  check(/wp-content|wp-includes/, "WordPress", "cms", "high");
  check(/cdn\.shopify\.com/, "Shopify", "ecommerce", "high");
  check(/googletagmanager\.com\/gtm/, "Google Tag Manager", "analytics", "high");
  check(/google-analytics\.com|gtag\(/, "Google Analytics", "analytics", "high");

  return found;
}
