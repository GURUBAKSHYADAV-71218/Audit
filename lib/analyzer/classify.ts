import type { ResourceType } from "@/types/audit";

export function classifyResourceType(
  playwrightType: string,
  url: string,
  mimeType: string
): ResourceType {
  const path = url.split("?")[0].toLowerCase();

  if (playwrightType === "document") return "document";
  if (playwrightType === "script") return "script";
  if (playwrightType === "stylesheet") return "stylesheet";
  if (playwrightType === "font") return "font";
  if (playwrightType === "xhr") return "xhr";
  if (playwrightType === "fetch") return "fetch";
  if (playwrightType === "media") return "media";

  if (playwrightType === "image") return "image";
  if (mimeType.startsWith("image/")) return "image";
  if (/\.(png|jpe?g|webp|avif|gif|svg|ico|bmp)$/.test(path)) return "image";

  if (mimeType.includes("font") || /\.(woff2?|ttf|otf|eot)$/.test(path)) return "font";
  if (mimeType.includes("javascript") || /\.(js|mjs|cjs)$/.test(path)) return "script";
  if (mimeType.includes("css") || /\.css$/.test(path)) return "stylesheet";

  return "other";
}

export function getImageFormat(url: string, mimeType: string): string | null {
  const path = url.split("?")[0].toLowerCase();
  const extMatch = path.match(/\.(png|jpe?g|webp|avif|gif|svg|bmp|ico)$/);
  if (extMatch) return extMatch[1].replace("jpg", "jpeg");
  if (mimeType.startsWith("image/")) return mimeType.split("/")[1] ?? null;
  return null;
}

export function getFontFormat(url: string, mimeType: string): string | null {
  const path = url.split("?")[0].toLowerCase();
  const extMatch = path.match(/\.(woff2|woff|ttf|otf|eot)$/);
  if (extMatch) return extMatch[1];
  if (mimeType.includes("woff2")) return "woff2";
  if (mimeType.includes("woff")) return "woff";
  if (mimeType.includes("truetype")) return "ttf";
  if (mimeType.includes("opentype")) return "otf";
  return null;
}

// Registrable-domain-ish comparison without pulling in a public-suffix-list
// dependency: compares the last two labels of the hostname. Good enough for
// first/third-party classification; not used for any security decision.
export function isSameSite(hostnameA: string, hostnameB: string): boolean {
  const rootOf = (h: string) => h.split(".").slice(-2).join(".");
  return rootOf(hostnameA) === rootOf(hostnameB);
}

const THIRD_PARTY_CATEGORY_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /google-analytics|googletagmanager|segment\.io|mixpanel|hotjar|amplitude|plausible|posthog/, category: "analytics" },
  { pattern: /doubleclick|googlesyndication|adservice|adsystem|taboola|outbrain|criteo|facebook\.com\/tr/, category: "advertising" },
  { pattern: /facebook\.net|twitter\.com|linkedin\.com|pinterest\.com|tiktok\.com/, category: "social" },
  { pattern: /intercom|drift\.com|zendesk|crisp\.chat|tawk\.to|livechat/, category: "chat" },
  { pattern: /cloudflare|jsdelivr|unpkg|cdnjs|fastly|akamai/, category: "cdn" },
  { pattern: /fonts\.googleapis|fonts\.gstatic|typekit|fontawesome/, category: "font" },
];

export function categorizeThirdParty(domain: string): "analytics" | "advertising" | "social" | "chat" | "cdn" | "font" | "other" {
  for (const rule of THIRD_PARTY_CATEGORY_RULES) {
    if (rule.pattern.test(domain)) return rule.category as never;
  }
  return "other";
}
