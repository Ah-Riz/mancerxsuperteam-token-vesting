import { NextRequest, NextResponse } from "next/server";
import { syncClaimEventsForSignatures } from "@/lib/indexer/claim-events";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signatures: unknown[] = Array.isArray(body?.signatures)
      ? body.signatures
      : typeof body?.signature === "string"
        ? [body.signature]
        : [];

    if (signatures.length === 0) {
      return NextResponse.json(
        { error: "signature is required" },
        { status: 400 },
      );
    }

    const result = await syncClaimEventsForSignatures(
      signatures.filter((signature): signature is string => typeof signature === "string"),
    );

    console.info("[POST /api/claims/sync] Synced claim events", {
      signatures,
      processed: result.processed,
      lastSlot: result.lastSlot,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[POST /api/claims/sync] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
