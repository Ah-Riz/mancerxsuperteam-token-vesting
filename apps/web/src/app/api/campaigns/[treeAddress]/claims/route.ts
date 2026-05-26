import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/api/json-response";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, claimEvents } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { withRoute } from "@/lib/api/route-wrapper";

async function getClaimsHandler(
  request: NextRequest,
  { params }: { params: Promise<{ treeAddress: string }> },
) {
  const { treeAddress } = await params;

  if (!treeAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(treeAddress)) {
    throw new ValidationError("Invalid address");
  }

  const { searchParams } = new URL(request.url);
  const beneficiary = searchParams.get("beneficiary");
  const fromSlotParam = searchParams.get("fromSlot");

  if (fromSlotParam !== null) {
    const n = Number(fromSlotParam);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      (fromSlotParam !== String(n) && !/^\d+$/.test(fromSlotParam))
    ) {
      throw new ValidationError("Invalid fromSlot");
    }
  }

  const fromSlot = fromSlotParam;
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.treeAddress, treeAddress))
    .limit(1);

  if (!campaign) {
    throw new NotFoundError("Campaign");
  }

  const conditions = [eq(claimEvents.campaignId, campaign.id)];
  if (beneficiary) {
    conditions.push(eq(claimEvents.beneficiary, beneficiary));
  }
  if (fromSlot) {
    conditions.push(sql`${claimEvents.slot} >= ${Number(fromSlot)}`);
  }

  const whereClause = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(claimEvents)
    .where(whereClause);

  const results = await db
    .select({
      beneficiary: claimEvents.beneficiary,
      leafIndex: claimEvents.leafIndex,
      amount: claimEvents.amount,
      totalClaimedByUser: claimEvents.totalClaimedByUser,
      totalClaimedOverall: claimEvents.totalClaimedOverall,
      milestoneIdx: claimEvents.milestoneIdx,
      signature: claimEvents.signature,
      slot: claimEvents.slot,
      blockTime: claimEvents.blockTime,
    })
    .from(claimEvents)
    .where(whereClause)
    .orderBy(desc(claimEvents.blockTime))
    .limit(limit);

  return jsonResponse({
    claims: results,
    total: count,
  });
}

export const GET = withRoute(
  { rateLimit: { requests: 60, window: 60 } },
  getClaimsHandler,
);
