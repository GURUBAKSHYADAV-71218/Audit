import type {
  Issue,
  ImageResource,
  ScriptResource,
  StylesheetResource,
  FontResource,
  Resource,
  ThirdPartyDomain,
} from "@/types/audit";

/**
 * Every rule here is deterministic and threshold-based — documented inline —
 * per the "no AI for core diagnosis" requirement. Thresholds are informed by
 * common web-performance guidance (web.dev / HTTP Archive) but are AUDIT's
 * own, not copied scoring logic from any third-party tool.
 */

const THRESHOLDS = {
  imageOversizedBytes: 300_000,
  imageCriticalBytes: 1_000_000,
  jsFileLargeBytes: 500_000,
  jsFileCriticalBytes: 1_000_000,
  jsTotalHighBytes: 1_500_000,
  cssFileLargeBytes: 150_000,
  cssTotalHighBytes: 400_000,
  fontTotalHighBytes: 300_000,
  fontFileCount: 5,
  thirdPartyRequestCountHigh: 20,
  thirdPartyBytesHigh: 800_000,
  uncompressedTextBytes: 20_000,
  shortCacheMaxAgeSeconds: 3600, // 1 hour
};

let issueCounter = 0;
function makeIssue(partial: Omit<Issue, "id">): Issue {
  issueCounter += 1;
  return { id: `issue-${issueCounter}-${Date.now().toString(36)}`, ...partial };
}

function fmtKB(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function detectImageIssues(images: ImageResource[]): Issue[] {
  const issues: Issue[] = [];

  const oversizedByDimensions = images.filter((img) => img.isOversized);
  if (oversizedByDimensions.length > 0) {
    const totalWaste = oversizedByDimensions.reduce((s, img) => s + img.sizeBytes * 0.4, 0);
    issues.push(
      makeIssue({
        severity: oversizedByDimensions.length > 3 ? "high" : "medium",
        category: "images",
        title: "Images larger than their display size",
        evidence: `${oversizedByDimensions.length} image(s) have intrinsic dimensions well above the size they're rendered at, e.g. ${oversizedByDimensions[0].intrinsicWidth}×${oversizedByDimensions[0].intrinsicHeight}px rendered at ${oversizedByDimensions[0].renderedWidth}×${oversizedByDimensions[0].renderedHeight}px.`,
        impact: "The browser downloads and decodes far more pixel data than is ever shown, wasting bandwidth and delaying paint.",
        recommendation: "Serve images at (or near) their actual rendered size, using responsive srcset/sizes or resized source files.",
        potentialSavingsBytes: Math.round(totalWaste),
        relatedResourceUrls: oversizedByDimensions.slice(0, 5).map((i) => i.url),
      })
    );
  }

  const heavyImages = images.filter((img) => img.sizeBytes > THRESHOLDS.imageOversizedBytes);
  if (heavyImages.length > 0) {
    const biggest = [...heavyImages].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    const anyCritical = heavyImages.some((i) => i.sizeBytes > THRESHOLDS.imageCriticalBytes);
    issues.push(
      makeIssue({
        severity: anyCritical ? "critical" : "high",
        category: "images",
        title: "Oversized image file size",
        evidence: `${biggest.url.split("/").pop()} is ${fmtKB(biggest.sizeBytes)}${biggest.format ? ` (${biggest.format})` : ""}.`,
        impact: "Large image payloads are one of the most common causes of slow page loads, especially on mobile networks.",
        recommendation: "Compress the image and consider a modern format like WebP or AVIF, which typically cut size by 25-50% at equivalent quality.",
        potentialSavingsBytes: Math.round(heavyImages.reduce((s, i) => s + i.sizeBytes, 0) * 0.5),
        relatedResourceUrls: heavyImages.slice(0, 5).map((i) => i.url),
      })
    );
  }

  const legacyFormat = images.filter(
    (img) => img.sizeBytes > 50_000 && img.format && ["png", "jpeg", "jpg", "gif"].includes(img.format)
  );
  if (legacyFormat.length >= 2) {
    issues.push(
      makeIssue({
        severity: "medium",
        category: "images",
        title: "Legacy image formats in use",
        evidence: `${legacyFormat.length} image(s) are served as PNG/JPEG/GIF rather than a modern format.`,
        impact: "Modern formats (WebP, AVIF) produce smaller files at similar visual quality, reducing transfer time.",
        recommendation: "Convert eligible images to WebP or AVIF, with a fallback for older browsers if needed.",
        potentialSavingsBytes: Math.round(legacyFormat.reduce((s, i) => s + i.sizeBytes, 0) * 0.3),
        relatedResourceUrls: legacyFormat.slice(0, 5).map((i) => i.url),
      })
    );
  }

  const missingLazy = images.filter((img) => !img.hasLazyLoading && img.sizeBytes > 100_000);
  if (missingLazy.length >= 3) {
    issues.push(
      makeIssue({
        severity: "low",
        category: "images",
        title: "Below-the-fold images not lazy-loaded",
        evidence: `${missingLazy.length} sizeable image(s) don't use loading="lazy".`,
        impact: "Images outside the initial viewport still compete for bandwidth with critical above-the-fold content.",
        recommendation: 'Add loading="lazy" to offscreen images so the browser defers fetching them.',
        relatedResourceUrls: missingLazy.slice(0, 5).map((i) => i.url),
      })
    );
  }

  return issues;
}

export function detectJavaScriptIssues(scripts: ScriptResource[]): Issue[] {
  const issues: Issue[] = [];
  const totalBytes = scripts.reduce((s, r) => s + r.sizeBytes, 0);

  const largeFiles = scripts.filter((s) => s.sizeBytes > THRESHOLDS.jsFileLargeBytes);
  if (largeFiles.length > 0) {
    const biggest = [...largeFiles].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    const anyCritical = largeFiles.some((s) => s.sizeBytes > THRESHOLDS.jsFileCriticalBytes);
    issues.push(
      makeIssue({
        severity: anyCritical ? "critical" : "high",
        category: "javascript",
        title: "Large JavaScript bundle",
        evidence: `${biggest.url.split("/").pop()} is ${fmtKB(biggest.sizeBytes)}${biggest.isFirstParty ? "" : " (third-party)"}.`,
        impact: "Large scripts take longer to download, parse, and execute — delaying interactivity, especially on slower devices.",
        recommendation: "Split the bundle with code-splitting/dynamic imports, and remove unused dependencies.",
        potentialSavingsMs: Math.round(biggest.sizeBytes / 50), // rough: ~50 bytes/ms on a mid-tier connection+CPU
        relatedResourceUrls: largeFiles.slice(0, 5).map((s) => s.url),
      })
    );
  }

  if (totalBytes > THRESHOLDS.jsTotalHighBytes) {
    issues.push(
      makeIssue({
        severity: totalBytes > THRESHOLDS.jsTotalHighBytes * 1.5 ? "critical" : "high",
        category: "javascript",
        title: "High total JavaScript weight",
        evidence: `${scripts.length} script(s) totalling ${fmtKB(totalBytes)}.`,
        impact: "The cumulative JS payload governs parse/compile/execute time, which directly delays when the page becomes interactive.",
        recommendation: "Audit dependencies for unused or duplicate libraries, and lazy-load non-critical JavaScript.",
        relatedResourceUrls: [],
      })
    );
  }

  const blocking = scripts.filter((s) => s.isRenderBlocking && s.isFirstParty);
  if (blocking.length > 0) {
    issues.push(
      makeIssue({
        severity: blocking.length > 2 ? "high" : "medium",
        category: "javascript",
        title: "Render-blocking scripts",
        evidence: `${blocking.length} script(s) load without async/defer/module and can block HTML parsing.`,
        impact: "Render-blocking scripts delay first paint because the browser must fetch and run them before continuing to parse the page.",
        recommendation: "Add the defer (or async, where execution order doesn't matter) attribute, or move scripts to load after critical content.",
        relatedResourceUrls: blocking.slice(0, 5).map((s) => s.url),
      })
    );
  }

  const thirdPartyScripts = scripts.filter((s) => !s.isFirstParty);
  const thirdPartyBytes = thirdPartyScripts.reduce((s, r) => s + r.sizeBytes, 0);
  if (thirdPartyScripts.length >= 5 || thirdPartyBytes > 500_000) {
    issues.push(
      makeIssue({
        severity: "medium",
        category: "javascript",
        title: "Heavy reliance on third-party scripts",
        evidence: `${thirdPartyScripts.length} third-party script(s) totalling ${fmtKB(thirdPartyBytes)}.`,
        impact: "Third-party scripts are outside your control and often block or slow down the main thread.",
        recommendation: "Audit third-party tags, remove ones that aren't earning their cost, and load the rest with async/defer.",
        relatedResourceUrls: thirdPartyScripts.slice(0, 5).map((s) => s.url),
      })
    );
  }

  return issues;
}

export function detectCssIssues(stylesheets: StylesheetResource[]): Issue[] {
  const issues: Issue[] = [];
  const totalBytes = stylesheets.reduce((s, r) => s + r.sizeBytes, 0);

  const largeFiles = stylesheets.filter((s) => s.sizeBytes > THRESHOLDS.cssFileLargeBytes);
  if (largeFiles.length > 0) {
    const biggest = [...largeFiles].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    issues.push(
      makeIssue({
        severity: "medium",
        category: "css",
        title: "Large stylesheet",
        evidence: `${biggest.url.split("/").pop()} is ${fmtKB(biggest.sizeBytes)}.`,
        impact: "Large, render-blocking CSS delays first paint until it's fully downloaded and parsed.",
        recommendation: "Remove unused CSS and consider splitting critical (above-the-fold) styles from the rest.",
        relatedResourceUrls: [biggest.url],
      })
    );
  }

  if (stylesheets.length > 5) {
    issues.push(
      makeIssue({
        severity: "low",
        category: "css",
        title: "Many separate stylesheets",
        evidence: `${stylesheets.length} stylesheet requests were made.`,
        impact: "Each render-blocking stylesheet adds a round trip before the page can paint.",
        recommendation: "Combine stylesheets where practical, or load non-critical ones asynchronously.",
        relatedResourceUrls: stylesheets.slice(0, 5).map((s) => s.url),
      })
    );
  }

  if (totalBytes > THRESHOLDS.cssTotalHighBytes) {
    issues.push(
      makeIssue({
        severity: "medium",
        category: "css",
        title: "High total CSS weight",
        evidence: `Total CSS across ${stylesheets.length} file(s) is ${fmtKB(totalBytes)}.`,
        impact: "Excess CSS is often largely unused on any given page, adding weight without benefit.",
        recommendation: "Estimate unused CSS with your browser's coverage tool and trim accordingly (AUDIT does not measure unused CSS directly).",
        relatedResourceUrls: [],
      })
    );
  }

  return issues;
}

export function detectFontIssues(fonts: FontResource[]): Issue[] {
  const issues: Issue[] = [];
  const totalBytes = fonts.reduce((s, r) => s + r.sizeBytes, 0);

  if (fonts.length > THRESHOLDS.fontFileCount) {
    issues.push(
      makeIssue({
        severity: "medium",
        category: "fonts",
        title: "Too many font files",
        evidence: `${fonts.length} font files were loaded.`,
        impact: "Each additional weight/style is a separate download that can delay text rendering.",
        recommendation: "Reduce the number of font weights/styles to only what the design actually uses.",
        relatedResourceUrls: fonts.slice(0, 5).map((f) => f.url),
      })
    );
  }

  if (totalBytes > THRESHOLDS.fontTotalHighBytes) {
    issues.push(
      makeIssue({
        severity: "medium",
        category: "fonts",
        title: "Large font payload",
        evidence: `Fonts total ${fmtKB(totalBytes)} across ${fonts.length} file(s).`,
        impact: "Large font files delay text becoming visible, or cause a visible font swap.",
        recommendation: "Use WOFF2, subset fonts to needed character sets, and consider fewer weights.",
        relatedResourceUrls: [],
      })
    );
  }

  const nonWoff2 = fonts.filter((f) => f.format && f.format !== "woff2");
  if (nonWoff2.length > 0) {
    issues.push(
      makeIssue({
        severity: "low",
        category: "fonts",
        title: "Fonts not using WOFF2",
        evidence: `${nonWoff2.length} font(s) are served as ${Array.from(new Set(nonWoff2.map((f) => f.format))).join(", ")} rather than WOFF2.`,
        impact: "WOFF2 is smaller than older font formats for equivalent quality, with excellent modern browser support.",
        recommendation: "Convert font files to WOFF2.",
        relatedResourceUrls: nonWoff2.slice(0, 5).map((f) => f.url),
      })
    );
  }

  const criticalUnpreloaded = fonts.filter((f) => !f.isPreloaded && f.isFirstParty);
  if (criticalUnpreloaded.length > 0 && fonts.length <= 4) {
    issues.push(
      makeIssue({
        severity: "low",
        category: "fonts",
        title: "Critical fonts not preloaded",
        evidence: `${criticalUnpreloaded.length} first-party font(s) have no <link rel="preload">.`,
        impact: "Without preloading, the browser discovers fonts late (after CSS parsing), which can delay text rendering or cause layout shift.",
        recommendation: 'Add <link rel="preload" as="font" crossorigin> for fonts used above the fold, and font-display: swap in @font-face.',
        relatedResourceUrls: criticalUnpreloaded.slice(0, 3).map((f) => f.url),
      })
    );
  }

  return issues;
}

export function detectThirdPartyIssues(thirdParty: ThirdPartyDomain[]): Issue[] {
  const issues: Issue[] = [];
  const totalRequests = thirdParty.reduce((s, d) => s + d.requestCount, 0);
  const totalBytes = thirdParty.reduce((s, d) => s + d.transferredBytes, 0);

  if (totalRequests > THRESHOLDS.thirdPartyRequestCountHigh || totalBytes > THRESHOLDS.thirdPartyBytesHigh) {
    const biggest = [...thirdParty].sort((a, b) => b.transferredBytes - a.transferredBytes)[0];
    issues.push(
      makeIssue({
        severity: totalBytes > THRESHOLDS.thirdPartyBytesHigh * 1.5 ? "high" : "medium",
        category: "third-party",
        title: "High third-party impact",
        evidence: `${thirdParty.length} third-party domain(s), ${totalRequests} requests, ${fmtKB(totalBytes)} total${biggest ? ` — largest is ${biggest.domain} (${fmtKB(biggest.transferredBytes)})` : ""}.`,
        impact: "Third-party scripts and embeds add requests, bytes, and often main-thread work that you don't directly control.",
        recommendation: "Audit each third-party tag's value versus its cost; remove or lazy-load ones that aren't essential to the initial view.",
        relatedResourceUrls: [],
      })
    );
  }

  return issues;
}

export function detectCachingIssues(resources: Resource[]): Issue[] {
  const issues: Issue[] = [];
  const staticTypes = new Set(["image", "script", "stylesheet", "font"]);
  const cacheable = resources.filter((r) => staticTypes.has(r.type) && r.status === 200);

  const missing = cacheable.filter((r) => !r.cacheControl);
  const short = cacheable.filter((r) => {
    if (!r.cacheControl) return false;
    const match = r.cacheControl.match(/max-age=(\d+)/);
    if (!match) return false;
    return Number(match[1]) < THRESHOLDS.shortCacheMaxAgeSeconds;
  });

  if (missing.length > 0) {
    issues.push(
      makeIssue({
        severity: missing.length > cacheable.length * 0.5 ? "high" : "medium",
        category: "caching",
        title: "Static assets missing cache headers",
        evidence: `${missing.length} of ${cacheable.length} static asset(s) have no Cache-Control header.`,
        impact: "Repeat visitors re-download these assets on every visit instead of using a cached copy.",
        recommendation: "Set a long Cache-Control (e.g. max-age=31536000, immutable) on fingerprinted static assets.",
        relatedResourceUrls: missing.slice(0, 5).map((r) => r.url),
      })
    );
  } else if (short.length > 0) {
    issues.push(
      makeIssue({
        severity: "low",
        category: "caching",
        title: "Short cache lifetimes on static assets",
        evidence: `${short.length} static asset(s) have a Cache-Control max-age under an hour.`,
        impact: "Short cache lifetimes reduce the benefit of caching for repeat visits.",
        recommendation: "Use long cache lifetimes for versioned/fingerprinted static assets.",
        relatedResourceUrls: short.slice(0, 5).map((r) => r.url),
      })
    );
  }

  return issues;
}

export function detectCompressionIssues(resources: Resource[]): Issue[] {
  const issues: Issue[] = [];
  const textTypes = new Set(["document", "script", "stylesheet", "xhr", "fetch"]);
  const textResources = resources.filter(
    (r) => textTypes.has(r.type) && r.sizeBytes > THRESHOLDS.uncompressedTextBytes && r.status === 200
  );
  const uncompressed = textResources.filter((r) => !r.contentEncoding || r.contentEncoding === "identity");

  if (uncompressed.length > 0) {
    const wastedBytes = uncompressed.reduce((s, r) => s + r.sizeBytes * 0.65, 0); // typical gzip/brotli ratio on text
    issues.push(
      makeIssue({
        severity: uncompressed.some((r) => r.sizeBytes > 200_000) ? "high" : "medium",
        category: "compression",
        title: "Text resources served without compression",
        evidence: `${uncompressed.length} text resource(s) over ${fmtKB(THRESHOLDS.uncompressedTextBytes)} have no gzip/Brotli Content-Encoding.`,
        impact: "Uncompressed text (HTML/CSS/JS/JSON) transfers 60-80% larger than it needs to.",
        recommendation: "Enable Brotli (preferred) or gzip compression on the server/CDN for text-based responses.",
        potentialSavingsBytes: Math.round(wastedBytes),
        relatedResourceUrls: uncompressed.slice(0, 5).map((r) => r.url),
      })
    );
  }

  return issues;
}

export function detectNetworkIssues(resources: Resource[], requestCount: number): Issue[] {
  const issues: Issue[] = [];
  const slow = resources.filter((r) => r.durationMs > 2000);

  if (requestCount > 100) {
    issues.push(
      makeIssue({
        severity: requestCount > 150 ? "high" : "medium",
        category: "network",
        title: "Very high request count",
        evidence: `${requestCount} network requests were made to load the page.`,
        impact: "Each request carries connection/latency overhead; a high count compounds delays, especially on high-latency networks.",
        recommendation: "Bundle/combine resources where sensible and eliminate unnecessary requests (duplicate libraries, unused tags).",
        relatedResourceUrls: [],
      })
    );
  }

  if (slow.length > 0) {
    const slowest = [...slow].sort((a, b) => b.durationMs - a.durationMs)[0];
    issues.push(
      makeIssue({
        severity: slowest.durationMs > 5000 ? "high" : "medium",
        category: "network",
        title: "Slow individual requests",
        evidence: `${slow.length} request(s) took over 2s, slowest was ${slowest.url.split("/").pop()} at ${(slowest.durationMs / 1000).toFixed(1)}s.`,
        impact: "Slow requests can block dependent rendering or delay the overall page-load event.",
        recommendation: "Investigate server response time, or move slow third-party calls off the critical rendering path.",
        relatedResourceUrls: slow.slice(0, 5).map((r) => r.url),
      })
    );
  }

  return issues;
}

export function prioritizeIssues(issues: Issue[]): Issue[] {
  const order: Record<Issue["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
}
