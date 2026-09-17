import dns from "node:dns/promises";
import net from "node:net";
import type { AuditError } from "@/types/audit";

// Blocks the well-known private / reserved / loopback / link-local / metadata
// ranges. This is intentionally conservative — the analyzer only needs to
// reach public websites.
const BLOCKED_IPV4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function ipv4ToLong(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const target = ipv4ToLong(ip);
  return BLOCKED_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToLong(base) & mask);
  });
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower === "::") return true; // unspecified
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — check the embedded IPv4 address too
    const mapped = lower.split(":").pop();
    if (mapped && net.isIPv4(mapped)) return isBlockedIPv4(mapped);
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data",
]);

export interface ValidatedUrl {
  url: URL;
  resolvedIp: string;
}

export async function validateAndResolveUrl(
  raw: string
): Promise<{ ok: true; data: ValidatedUrl } | { ok: false; error: AuditError }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return {
      ok: false,
      error: { code: "invalid_url", message: "That doesn't look like a valid URL." },
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      error: { code: "invalid_url", message: "Only http:// and https:// URLs are supported." },
    };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    return {
      ok: false,
      error: { code: "blocked_target", message: "This host can't be scanned." },
    };
  }

  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isBlockedIPv4(hostname)) {
      return {
        ok: false,
        error: { code: "blocked_target", message: "Private or internal addresses can't be scanned." },
      };
    }
    if (net.isIPv6(hostname) && isBlockedIPv6(hostname)) {
      return {
        ok: false,
        error: { code: "blocked_target", message: "Private or internal addresses can't be scanned." },
      };
    }
    return { ok: true, data: { url, resolvedIp: hostname } };
  }

  // Resolve DNS ourselves and check the actual IP, so a hostname can't be
  // used to sneak past the hostname-based checks above (DNS rebinding /
  // "attacker-controlled DNS" style SSRF).
  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: false });
    addresses = records.map((r) => r.address);
  } catch {
    return {
      ok: false,
      error: { code: "unreachable", message: "We couldn't resolve that domain." },
    };
  }

  if (addresses.length === 0) {
    return {
      ok: false,
      error: { code: "unreachable", message: "We couldn't resolve that domain." },
    };
  }

  for (const ip of addresses) {
    if (net.isIPv4(ip) && isBlockedIPv4(ip)) {
      return {
        ok: false,
        error: { code: "blocked_target", message: "This domain resolves to a private address and can't be scanned." },
      };
    }
    if (net.isIPv6(ip) && isBlockedIPv6(ip)) {
      return {
        ok: false,
        error: { code: "blocked_target", message: "This domain resolves to a private address and can't be scanned." },
      };
    }
  }

  return { ok: true, data: { url, resolvedIp: addresses[0] } };
}

// Re-check a redirect target the same way the original URL was checked.
// Playwright follows redirects itself, so we validate the final URL and any
// intermediate navigation targets via the `request`/`response` events in
// browser.ts, calling this same function.
export const isBlockedResolvedIp = (ip: string): boolean =>
  net.isIPv4(ip) ? isBlockedIPv4(ip) : isBlockedIPv6(ip);
