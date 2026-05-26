import { NextRequest, NextResponse } from "next/server";
import { jsonResponse } from "@/lib/api/json-response";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, rootVersions, claimEvents, leaves } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// GET /api/campaigns/:treeAddress — campaign detail with analytics
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ treeAddress: string }> },
) {
  try {
    const { treeAddress } = await params;

    // Find campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.treeAddress, treeAddress))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    // Fetch root versions for this campaign
    const rootVersionList = await db
      .select({
        id: rootVersions.id,
        version: rootVersions.version,
        merkleRoot: rootVersions.merkleRoot,
        leafCount: rootVersions.leafCount,
        createdAt: rootVersions.createdAt,
        ipfsCid: rootVersions.ipfsCid,
      })
      .from(rootVersions)
      .where(eq(rootVersions.campaignId, campaign.id))
      .orderBy(sql`${rootVersions.version} DESC`);

    const latestRootVersion = rootVersionList[0];
    const latestLeaves = latestRootVersion
      ? await db
          .select({
            beneficiary: leaves.beneficiary,
            amount: leaves.amount,
            releaseType: leaves.releaseType,
          })
          .from(leaves)
          .where(eq(leaves.rootVersionId, latestRootVersion.id))
      : [];

    const claimTotals = await db
      .select({
        beneficiary: claimEvents.beneficiary,
        claimedAmount: sql<string>`max(${claimEvents.totalClaimedByUser})::text`,
      })
      .from(claimEvents)
      .where(eq(claimEvents.campaignId, campaign.id))
      .groupBy(claimEvents.beneficiary);

    const claimedByBeneficiary = new Map(
      claimTotals.map((row) => [row.beneficiary, BigInt(row.claimedAmount)]),
    );
    const recipientAgg = new Map<string, { allocation: bigint; leafCount: number }>();
    for (const leaf of latestLeaves) {
      const current = recipientAgg.get(leaf.beneficiary) ?? { allocation: 0n, leafCount: 0 };
      recipientAgg.set(leaf.beneficiary, {
        allocation: current.allocation + BigInt(leaf.amount),
        leafCount: current.leafCount + 1,
      });
    }
    const recipientList = [...recipientAgg.entries()]
      .map(([beneficiary, summary]) => ({
        beneficiary,
        allocation: summary.allocation.toString(),
        leafCount: summary.leafCount,
        claimedAmount: (claimedByBeneficiary.get(beneficiary) ?? 0n).toString(),
      }))
      .sort((a, b) => b.leafCount - a.leafCount || a.beneficiary.localeCompare(b.beneficiary));

    // Compute analytics from claim_events
    const [analytics] = await db
      .select({
        uniqueClaimers: sql<number>`count(distinct ${claimEvents.beneficiary})::int`,
        claimCount: sql<number>`count(*)::int`,
      })
      .from(claimEvents)
      .where(eq(claimEvents.campaignId, campaign.id));

    const totalSupply = BigInt(campaign.totalSupply);
    const totalClaimed = BigInt(campaign.totalClaimed);
    const percentClaimed =
      totalSupply > 0n
        ? Number((totalClaimed * 10000n) / totalSupply) / 100
        : 0;

    const hasMilestoneLeaves = latestLeaves.some((l) => l.releaseType === 2);

    return jsonResponse({
      treeAddress: campaign.treeAddress,
      creator: campaign.creator,
      mint: campaign.mint,
      campaignId: campaign.campaignId,
      merkleRoot: campaign.merkleRoot,
      leafCount: campaign.leafCount,
      totalSupply: campaign.totalSupply,
      totalClaimed: campaign.totalClaimed,
      cancellable: campaign.cancellable,
      paused: campaign.paused,
      cancelledAt: campaign.cancelledAt,
      createdAt: campaign.createdAt,
      metadata: campaign.metadata,
      hasMilestoneLeaves,
      analytics: {
        uniqueClaimers: analytics.uniqueClaimers,
        claimCount: analytics.claimCount,
        percentClaimed,
        rootVersionCount: rootVersionList.length,
      },
      rootVersions: rootVersionList,
      recipients: recipientList,
    });
  } catch (error) {
    console.error("[GET /api/campaigns/:treeAddress] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
