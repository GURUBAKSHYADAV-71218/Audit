import type { AuditResult } from "@/types/audit";

// Deliberately simple in-memory store, per the "no database requirement"
// design goal. Results live for a limited time so a shareable /report/[id]
// link works shortly after a scan, without needing persistent storage.
// On serverless platforms with multiple instances this won't be shared
// across instances — documented in the README as a known tradeoff for v1.

const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface StoredResult {
  result: AuditResult;
  expiresAt: number;
}

const store = new Map<string, StoredResult>();

function sweep() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt < now) store.delete(id);
  }
}

export function saveResult(result: AuditResult): void {
  sweep();
  store.set(result.id, { result, expiresAt: Date.now() + TTL_MS });
}

export function getResult(id: string): AuditResult | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return entry.result;
}
