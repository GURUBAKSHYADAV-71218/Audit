"use client";

import type { AuditStreamEvent, Device } from "@/types/audit";

/**
 * Posts to /api/audit and streams back real progress events as the server
 * emits them (Server-Sent Events over a plain fetch body). No polling, no
 * simulated timing — each event corresponds to a stage the server actually
 * just completed.
 */
export async function streamAudit(
  url: string,
  device: Device,
  onEvent: (event: AuditStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, device }),
    signal,
  });

  if (!res.body) {
    if (!res.ok) {
      onEvent({ type: "error", error: { code: "scan_failed", message: "The server didn't return a response." } });
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const event = JSON.parse(line.slice("data: ".length)) as AuditStreamEvent;
        onEvent(event);
      } catch {
        // Ignore malformed chunks rather than crashing the whole scan UI.
      }
    }
  }
}
