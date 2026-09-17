import { NextRequest } from "next/server";
import { validateAndResolveUrl } from "@/lib/security/ssrf";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { runAudit } from "@/lib/analyzer";
import { stageLabel } from "@/lib/stages";
import { saveResult } from "@/lib/store";
import type { AuditStreamEvent, Device, StageId } from "@/types/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function sse(event: AuditStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return new Response(
      sse({
        type: "error",
        error: {
          code: "rate_limited",
          message: "Too many scans from this connection recently. Please try again in a few minutes.",
        },
      }),
      { status: 429, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  let body: { url?: string; device?: Device };
  try {
    body = await req.json();
  } catch {
    return new Response(sse({ type: "error", error: { code: "invalid_url", message: "Invalid request." } }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const rawUrl = typeof body.url === "string" ? body.url : "";
  const device: Device = body.device === "mobile" ? "mobile" : "desktop";

  const validated = await validateAndResolveUrl(rawUrl);
  if (!validated.ok) {
    return new Response(sse({ type: "error", error: validated.error }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AuditStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          // Controller may already be closed if the client disconnected.
        }
      };

      emit({ type: "stage", stage: "validate", label: stageLabel("validate"), status: "done" });

      const outcome = await runAudit(validated.data.url, device, (stage: StageId, status, detail) => {
        emit({ type: "stage", stage, label: stageLabel(stage), status, detail });
      });

      if (!outcome.ok) {
        emit({ type: "error", error: outcome.error });
        controller.close();
        return;
      }

      saveResult(outcome.result);
      emit({ type: "result", result: outcome.result });
      controller.close();
    },
    cancel() {
      // Client disconnected — the in-flight browser scan will still finish
      // and its result simply won't be delivered; store() call is skipped
      // naturally since this callback doesn't prevent runAudit from settling,
      // but we don't hold the connection open artificially either.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
