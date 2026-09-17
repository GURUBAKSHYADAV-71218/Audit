import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core and @sparticuz/chromium-min must not be bundled by
  // webpack/Turbopack — both rely on normal Node `require()` resolution
  // (and, for chromium-min, a runtime network fetch) rather than anything a
  // bundler should rewrite. (Next.js already auto-excludes these packages
  // by default in recent versions; listing them explicitly keeps this
  // working even if that default list ever changes upstream.)
  //
  // Note there is deliberately no `outputFileTracingIncludes` here. An
  // earlier version of this project used the full `@sparticuz/chromium`
  // package, which ships its Chromium binary as local files and therefore
  // needed those files force-included in the trace. That approach hit a
  // known, currently-open Next.js/Turbopack-on-Vercel issue where those
  // binary files get silently dropped from the deployed function even with
  // outputFileTracingIncludes configured (see README → "Why chromium-min").
  // Switching to @sparticuz/chromium-min, which fetches its binary over
  // HTTPS at runtime instead of shipping it as a local file, removes the
  // dependency on file tracing for this entirely — there is no local
  // binary for the tracer to lose.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium-min"],
};

export default nextConfig;
