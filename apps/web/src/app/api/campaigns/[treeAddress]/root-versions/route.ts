import { NextRequest, NextResponse } from "next/server";
import { jsonResponse } from "@/lib/api/json-response";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, rootVersions, leaves } from "@/lib/db/schema";
import { createRootVersionRequestSchema } from "@/lib/api/validators";
import { verifyAllLeaves } from "@/lib/merkle/verify";

function u64String(value: string | number): string {
  return String(value);
}

// ---------------------------------------------------------------------------
// POST /api/campaigns/:treeAddress/root-versions — root rotation
// Creates a new root version with updated leaves.
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ treeAddress: string }> },
) {
  try {
    const { treeAddress } = await params;
    const body = await request.json();
    const parsed = createRootVersionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const proofCheck = verifyAllLeaves(data.leaves, data.merkleRoot);
    if (!proofCheck.ok) {
      const leafSuffix =
        proofCheck.leafIndex !== undefined
          ? ` for leaf index ${proofCheck.leafIndex}`
          : "";
      return NextResponse.json(
        { error: `${proofCheck.error}${leafSuffix}` },
        { status: 400 },
      );
    }

    // Find campaign by tree_address
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.treeAddress, treeAddress))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    // Get current max version
    const [currentMax] = await db
      .select({ version: sql<number>`coalesce(max(${rootVersions.version}), 0)::int` })
      .from(rootVersions)
      .where(eq(rootVersions.campaignId, campaign.id));

    const nextVersion = currentMax.version + 1;

    // Insert new root version
    const [insertedRootVersion] = await db
      .insert(rootVersions)
      .values({
        campaignId: campaign.id,
        merkleRoot: data.merkleRoot,
        leafCount: data.leafCount,
        ipfsCid: data.ipfsCid ?? null,
        version: nextVersion,
        createdAt: String(Math.floor(Date.now() / 1000)),
      })
      .returning({ id: rootVersions.id });

    // Insert new leaves
    const leafRows = data.leaves.map((leaf) => ({
      rootVersionId: insertedRootVersion.id,
      leafIndex: leaf.leafIndex,
      beneficiary: leaf.beneficiary,
      amount: u64String(leaf.amount),
      releaseType: leaf.releaseType,
      startTime: u64String(leaf.startTime),
      cliffTime: u64String(leaf.cliffTime),
      endTime: u64String(leaf.endTime),
      milestoneIdx: leaf.milestoneIdx,
      proof: leaf.proof,
    }));

    if (leafRows.length > 0) {
      await db.insert(leaves).values(leafRows);
    }

    // Update the campaign's current merkle root and leaf count
    await db
      .update(campaigns)
      .set({
        merkleRoot: data.merkleRoot,
        leafCount: data.leafCount,
      })
      .where(eq(campaigns.id, campaign.id));

    return jsonResponse(
      { ok: true, version: nextVersion },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/campaigns/:treeAddress/root-versions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
