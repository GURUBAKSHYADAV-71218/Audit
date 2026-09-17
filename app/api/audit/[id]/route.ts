import { NextRequest, NextResponse } from "next/server";
import { getResult } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getResult(id);

  if (!result) {
    return NextResponse.json(
      { error: { code: "not_found", message: "This audit result has expired or doesn't exist. Results are kept for 30 minutes." } },
      { status: 404 }
    );
  }

  return NextResponse.json({ result });
}
