# AUDIT

**Find what's slowing your website down.**

AUDIT is a real website-performance auditor. Enter a public URL, it loads the page in an actual headless browser, captures what really happened (every request, image, script, stylesheet, and font), and gives you a deterministic, evidence-based diagnosis of what to fix first.

There is no AI in the core diagnosis path. Scoring and issue detection are rule-based and documented in code (`lib/scoring`, `lib/recommendations`) — every point lost and every recommendation traces back to a specific, inspectable rule.

## Deploying to Vercel

This is the primary, supported deployment target. It requires **zero configuration and zero environment variables** — just push and deploy.

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Deploy.

That's it. The browser architecture (below) auto-detects that it's running on Vercel and uses the correct Chromium build with no setup required.

## Local development

```bash
npm install
npx playwright install chromium   # downloads a real local Chromium build
npm run dev
```

Open http://localhost:3000. Locally, AUDIT uses a plain `npx playwright install`-managed Chromium — the same one you'd use for any Playwright project. It does **not** use `@sparticuz/chromium-min` locally (that path is serverless-only and isn't meant for a dev machine); see "Browser architecture" below for exactly how the switch happens.

## Production build

```bash
npm run build
npm start
```

---

## Browser architecture

AUDIT needs a real Chromium to analyze arbitrary websites. The two environments it runs in have fundamentally different constraints, so it uses two different Chromium sources, selected automatically at runtime:

| Environment | Chromium source | How it's selected |
|---|---|---|
| Vercel Function (production) | [`@sparticuz/chromium-min`](https://github.com/Sparticuz/chromium) — a serverless-optimized Chromium build, fetched over HTTPS at cold start and extracted to `/tmp` | `process.env.VERCEL` (or `AWS_LAMBDA_FUNCTION_NAME`) is set automatically by the platform — no configuration needed |
| Local dev | Your own `npx playwright install chromium` download | Neither of the above env vars is set |

This logic lives entirely in `lib/analyzer/browser.ts::launchBrowser()`. Both paths use the same `playwright-core` (not `playwright` — the "core" package has no bundled browser of its own, which is exactly what lets it drive either Chromium source interchangeably).

```
lib/analyzer/browser.ts
  launchBrowser()
    isManagedServerless()?          <- process.env.VERCEL / AWS_LAMBDA_FUNCTION_NAME
      yes -> @sparticuz/chromium-min.executablePath(packUrl) + .args
              packUrl defaults to Sparticuz's own GitHub Release asset for
              the pinned version; overridable via CHROMIUM_PACK_URL
      no  -> local Playwright-managed Chromium (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH override)
    playwright-core's chromium.launch({ executablePath, args })
```

### Why `@sparticuz/chromium-min` + a remote pack, and not the full `@sparticuz/chromium` package

An earlier pass at this used the full `@sparticuz/chromium` package, which ships its ~65 MB Chromium binary as local `.br` files inside the npm package and decompresses them from `/tmp` — no network needed. That version was built, and independently verified end-to-end in a sandboxed environment: `@sparticuz/chromium` resolved, Playwright launched it, and it navigated a real site successfully. **But the live Vercel deployment still failed with the same "Chromium isn't installed" error**, which meant the sandbox verification — real as it was — wasn't catching something specific to the actual Vercel build/deploy pipeline.

Investigating that gap surfaced a **currently open, unresolved upstream issue** ([`vercel-labs/agent-browser#230`](https://github.com/vercel-labs/agent-browser/issues/230), opened Jan 2026) reporting the *exact* failure — `Error: The input directory ".../@sparticuz/chromium/bin" does not exist` — on the *exact* stack this project uses: **Next.js 16 App Router, Turbopack build, deployed on Vercel.** The package's own README independently confirms the general shape of this failure class: "If you see the error `The input directory ".../bin" does not exist`, this almost certainly means the package was not externalized in your bundler configuration" — and `serverExternalPackages` is Next's documented way to do exactly that.

In other words: `serverExternalPackages` stops the bundler from rewriting `@sparticuz/chromium`'s *JavaScript*, but Next.js's Output File Tracing — which decides what actually gets uploaded to the deployed function — works by statically following `import`/`require()` calls, and `@sparticuz/chromium` reads its own binary via a dynamic filesystem path, not a static `require()`. `outputFileTracingIncludes` is the documented fix for that gap, and it **did** work in this project's own local build trace (confirmed by inspecting `.next/server/app/api/audit/route.js.nft.json` before and after adding it — the binaries were missing, then present). But the open GitHub issue above shows other developers on the identical stack (Next 16 + Turbopack + Vercel) still hitting the missing-`bin`-directory error *after* correctly configuring this — meaning Vercel's actual build/deploy pipeline can behave differently from a local `next build`'s trace output, most plausibly due to Turbopack's output-file-tracing support for this edge case still maturing. A local trace passing is evidence, but per this task's instruction to treat the live Vercel failure as the source of truth, it isn't proof, and there's a real, named, still-open bug that fits the symptom exactly.

Given that, continuing to patch the file-tracing approach would mean shipping a fix whose reliability depends on an open upstream bug in Next.js/Turbopack's interaction with Vercel's build pipeline — not something this project can fix or fully verify from the outside. **`@sparticuz/chromium-min` removes the dependency on file tracing entirely**, which is the officially documented fallback in the package's own README for exactly this situation ("If you need less than 50mb then use `@sparticuz/chromium-min` and host the tar yourself"). It ships with *no* local binary at all (the installed package is ~80 KB, vs. ~67 MB for the full package) — there is nothing for a bundler to mishandle and nothing for a tracer to lose, because the Chromium binary is fetched over plain HTTPS at cold start instead of read off a locally-bundled file.

The default `packUrl` points at Sparticuz's own GitHub Release asset for the pinned version (`chromium-v153.0.0-pack.x64.tar`) — a file they publish and maintain specifically for this purpose, so no additional hosting/infrastructure is introduced by this project. It can be overridden with the optional `CHROMIUM_PACK_URL` environment variable (e.g. to self-host the same file closer to your Vercel region for faster cold starts), but nothing needs to be configured for a working deployment.

**Traded off:** a cold start now needs a short HTTPS download (~1.8 s for the ~65 MB pack tarball, measured in testing below) before the browser can launch, versus ~0 ms when the binary is already local. Warm invocations reuse the same `/tmp` extraction and pay this cost only once per container. Given Chromium launch + page navigation already take several seconds, this is a small addition and, unlike the file-tracing approach, doesn't depend on unresolved upstream behavior.

### Next.js / bundler configuration

`next.config.ts` sets:

```ts
serverExternalPackages: ["playwright-core", "@sparticuz/chromium-min"]
```

so neither package's JS is rewritten by webpack/Turbopack. There is deliberately **no** `outputFileTracingIncludes` anymore — with no local binary to trace, it isn't needed, which is precisely the point: this configuration no longer depends on Output File Tracing behaving a particular way.

### Function runtime, memory, and duration

- `app/api/audit/route.ts` explicitly sets `export const runtime = "nodejs"` — Playwright/Chromium cannot run on the Edge runtime, only Node.js.
- `vercel.json` sets `memory: 1769` and `maxDuration: 60` for the audit route. Chromium under load benefits from more than the 1024 MB default (Sparticuz's own guidance: "allocate at least 512 MB, 1600 MB or more recommended"), and a real page load + analysis can take longer than the default 10 s. Vercel's Hobby plan supports up to 60 s when explicitly configured this way.
- Internal timeouts (`NAV_TIMEOUT_MS`, `OVERALL_TIMEOUT_MS` in `browser.ts`) stay comfortably under that 60 s ceiling, with room for the pack download, navigation, and cleanup.
- Traced function size for `/api/audit` is now **~13 MB uncompressed** (down from ~83 MB with the full package) — the Chromium binary itself is no longer part of the deployed function at all, it's fetched at runtime. Confirmed by summing the actual file sizes listed in `route.js.nft.json` after a clean build.

---

## What was actually wrong, and how each fix was verified

The deployment reported `"Chromium isn't installed"` on every scan. This went through two rounds of investigation:

**Round 1 — two bugs found, both fixed, both verified in a sandboxed environment (but not on live Vercel):**

1. `launchBrowser()` never actually used the (correctly installed) `@sparticuz/chromium` dependency — it still called a bare `chromium.launch()` with no `executablePath`. Fixed by branching on `process.env.VERCEL` and resolving `@sparticuz/chromium`'s `executablePath()`/`args`.
2. Next.js's Output File Tracing was silently dropping the Chromium binary from the deployed function even with the launcher fixed. Fixed with `outputFileTracingIncludes`.

Both were verified by actually running the browser with `VERCEL=1` forcing the production code path, in a Linux sandbox: real Chromium launch, real navigation, real captured data. **Despite that, the actual live Vercel deployment still failed with the same error** — which is the reason this round of work exists.

**Round 2 — root cause of the gap, and the architecture change:**

Treating the live Vercel failure as ground truth (not the sandbox pass), the investigation found a currently-open upstream issue matching this project's exact stack (Next 16 + Turbopack + Vercel + `@sparticuz/chromium`) with the identical symptom — see "Why `@sparticuz/chromium-min`..." above for the full explanation. The fix was to stop depending on Next.js's file tracing for the Chromium binary at all, by switching to `@sparticuz/chromium-min` with a remote pack URL.

**This was verified three ways, each with real, reproducible output:**

**1. Standalone script, forcing the exact production code path with `VERCEL=1`, with `/tmp` cleared first to guarantee a genuinely cold run (not a leftover cached extraction):**

```
AUDIT_BROWSER_FETCHING_PACK packUrl=https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar
AUDIT_BROWSER_EXECUTABLE_RESOLVED path=/tmp/chromium ms=1814
AUDIT_BROWSER_LAUNCHED ms=50
NAV_STATUS=200  PAGE_TITLE="PyPI · The Python Package Index"  REQUESTS_CAPTURED=31
TOTAL_MS=2364
```

**2. Full application, real production build (`npm run build && VERCEL=1 npm start`), `/tmp` cleared, hitting the real streaming `/api/audit` endpoint with `https://pypi.org/`:**

```
[audit] AUDIT_BROWSER_START serverless=true platform=linux
[audit] AUDIT_BROWSER_FETCHING_PACK packUrl=https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar
[audit] AUDIT_BROWSER_EXECUTABLE_RESOLVED executablePath=/tmp/chromium
[audit] AUDIT_BROWSER_LAUNCHED
[audit] AUDIT_PAGE_NAVIGATION_START
[audit] AUDIT_PAGE_NAVIGATION_COMPLETE status=200
[audit] AUDIT_BROWSER_CLOSED
```

...followed by a real, complete `AuditResult` streamed back over SSE — not fabricated data:

```
score: 92
requestCount: 31
pageSizeBytes: 571447
loadTimeMs: 369
issues: 3
diagnosis: "Your page is primarily slowed by heavy JavaScript and missing compression."
```

SSRF blocking was re-verified against the same running server, under the same `VERCEL=1` conditions: `http://localhost:3151` and `http://169.254.169.254/` were both correctly rejected with `blocked_target` before any browser was involved.

**3. Local dev path (no `VERCEL` env set) re-confirmed unaffected by this change:** hits `browser_unavailable` with the correct local-specific message (`Run npx playwright install chromium and try again`) and the server log shows `serverless=false` — confirming `@sparticuz/chromium-min` is never imported at all outside the serverless branch, so nothing about local Windows/Playwright development changed.

**A known, unrelated caveat surfaced during this testing, worth documenting:** some real sites (e.g. `npmjs.com`) run bot-detection (Cloudflare "Just a moment...") that challenges automated headless Chromium from a datacenter IP and returns a 403 instead of the real page. This is expected behavior for *any* headless-browser tool hitting a bot-protected site — not a defect in AUDIT's Chromium setup.

**What this environment could not verify:** the actual live Vercel deployment itself. This sandbox isn't Vercel — it's a Linux container with its own restricted outbound network allowlist (which happens to include GitHub's release-asset CDN, which is how the remote-pack download above could be tested for real, but does not include arbitrary sites, hence testing against `pypi.org`). Every individual piece — dependency resolution, bundler externalization, the remote-download code path, real Chromium launch, real navigation, real data capture, SSRF enforcement — has been proven with reproducible command output on the same OS family (Linux x64) Vercel Functions run on. The specific bug this round was chasing (Next.js/Turbopack file-tracing on Vercel specifically) is exactly the kind of platform-specific issue that a non-Vercel sandbox can't fully rule out even when everything else checks out — which is exactly why this round replaced the tracing-dependent approach with one that has no dependency on Vercel's specific build/trace behavior at all, rather than trying to further debug something unverifiable from here.

## Architecture

```
app/
  page.tsx                 Landing -> scanning -> report state machine (client)
  report/[id]/page.tsx     Shareable report link (server component)
  api/audit/route.ts       POST - runs a scan, streams real progress via SSE, Node runtime
  api/audit/[id]/route.ts  GET - fetch a stored result by id

components/
  landing/    Hero, example preview (demo data), how-it-works, checks grid, CTA
  audit/      URL form, scan progress screen, error states
  report/     Score ring, overview, "why slow", priority fixes, third-party,
              cache/compression, tech stack, report composer
  waterfall/  Request waterfall with filters + detail modal
  resources/  Searchable/sortable resource table

lib/
  analyzer/
    browser.ts     Playwright scan - the only place that touches a real browser.
                    launchBrowser() here is the Vercel-vs-local switch described above.
    classify.ts     Resource type / format / first-vs-third-party helpers
    diagnose.ts     "Why is this slow" summary + top contributors
    index.ts        Orchestrator: runs the scan, emits stage events, assembles AuditResult
  scoring/          Deterministic 0-100 scoring model, documented weights
  recommendations/  Deterministic, threshold-based issue detection rules
  security/
    ssrf.ts          URL validation + DNS-based SSRF protection
    rateLimit.ts      Simple in-memory per-IP rate limit
  store.ts          In-memory result store with TTL (no database) - see caveat below
  stages.ts         Shared stage labels (client-safe; browser.ts is not)
```

## Security

- Only `http://`/`https://` URLs are accepted.
- Hostnames are resolved via DNS and the resolved IP is checked against private/loopback/link-local/metadata/reserved ranges before any request is made (`lib/security/ssrf.ts`).
- Every subresource request during the scan is re-validated the same way via Playwright's request interception, so a redirect can't be used to reach an internal target after the initial check passes.
- None of this was weakened or bypassed to make the browser launch on Vercel — it's the same validation logic, re-verified under the production code path (see above).
- A simple in-memory rate limit (8 scans / 10 minutes / IP) guards against casual abuse. It resets per server instance — acceptable for a v1, worth swapping for a shared store (Redis, etc.) if you run multiple instances and abuse becomes an issue.

## Known limitation: shareable `/report/[id]` links on Vercel

`lib/store.ts` is an in-memory `Map` — intentionally, per the "no database" design goal. On Vercel, a `GET /report/[id]` request can land on a different function instance than the one that ran the `POST /api/audit` scan, in which case that instance's memory won't have the result and the page will show "This report has expired." The primary flow (submit a URL, watch it scan, see the report) is unaffected - the report is rendered from the data already streamed to the browser, not re-fetched. Only *direct navigation to a `/report/[id]` link from a fresh request* is subject to this. If persistent shareable links become a hard requirement, the fix is a small one (swap `lib/store.ts`'s Map for Vercel KV or Upstash Redis, same TTL semantics) - deliberately not done here to avoid adding infrastructure that wasn't asked for.

## Observability

`lib/analyzer/browser.ts` logs a small set of tagged, non-sensitive lifecycle events to help diagnose a failed scan from Vercel's function logs without needing to reproduce it:

```
AUDIT_BROWSER_START
AUDIT_BROWSER_EXECUTABLE_RESOLVED   (serverless only)
AUDIT_BROWSER_LAUNCHED
AUDIT_PAGE_NAVIGATION_START
AUDIT_PAGE_NAVIGATION_COMPLETE
AUDIT_BROWSER_CLOSED
```

...plus `*_FAILED` variants at each stage on error. None of these log cookies, headers, page content, or secrets - only stage names, status codes, and sanitized error messages, which are also what gets categorized into the `AuditError.code` returned to the client (`invalid_url`, `blocked_target`, `unreachable`, `timeout`, `browser_unavailable`, `scan_failed`, `rate_limited`) rather than a raw stack trace.

## What's intentionally not included

Per the project's design philosophy: no auth, no payments, no teams, no database, no queue/worker infrastructure, no Docker. Scan results live in memory for 30 minutes so a shareable `/report/[id]` link works shortly after a scan on a warm instance (see caveat above), then they're gone - nothing is persisted.
