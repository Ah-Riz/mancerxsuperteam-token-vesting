import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ treeAddress: string }> },
) {
  try {
    const { treeAddress } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if ("paused" in body && typeof body.paused === "boolean") {
      updates.paused = body.paused;
    }
    if (
      "cancelledAt" in body &&
      (typeof body.cancelledAt === "number" || body.cancelledAt === null)
    ) {
      updates.cancelledAt = body.cancelledAt;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const result = await db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.treeAddress, treeAddress))
      .returning({ id: campaigns.id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/campaigns/:treeAddress/status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
