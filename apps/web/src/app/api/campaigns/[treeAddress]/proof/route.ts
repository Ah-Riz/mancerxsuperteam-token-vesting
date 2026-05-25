import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/api/json-response";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, rootVersions, leaves } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { withRoute } from "@/lib/api/route-wrapper";

async function getProofHandler(
  request: NextRequest,
  { params }: { params: Promise<{ treeAddress: string }> },
) {
  const { treeAddress } = await params;
  const { searchParams } = new URL(request.url);
  const beneficiary = searchParams.get("beneficiary");
  const leafIndexParam = searchParams.get("leafIndex");
  const allParam = searchParams.get("all");

  if (!beneficiary) {
    throw new ValidationError("Missing required query parameter: beneficiary");
  }

  const [campaign] = await db
    .select({ id: campaigns.id, merkleRoot: campaigns.merkleRoot })
    .from(campaigns)
    .where(eq(campaigns.treeAddress, treeAddress))
    .limit(1);

  if (!campaign) {
    throw new NotFoundError("Campaign");
  }

  const [latestVersion] = await db
    .select({ id: rootVersions.id, version: rootVersions.version })
    .from(rootVersions)
    .where(eq(rootVersions.campaignId, campaign.id))
    .orderBy(sql`${rootVersions.version} DESC`)
    .limit(1);

  if (!latestVersion) {
    throw new NotFoundError("Root version");
  }

  const conditions = [
    eq(leaves.beneficiary, beneficiary),
    eq(leaves.rootVersionId, latestVersion.id),
  ];
  if (leafIndexParam !== null) {
    conditions.push(eq(leaves.leafIndex, Number(leafIndexParam)));
  }

  const matchedLeaves = await db
    .select({
      leafIndex: leaves.leafIndex,
      beneficiary: leaves.beneficiary,
      amount: leaves.amount,
      releaseType: leaves.releaseType,
      startTime: leaves.startTime,
      cliffTime: leaves.cliffTime,
      endTime: leaves.endTime,
      milestoneIdx: leaves.milestoneIdx,
      proof: leaves.proof,
    })
    .from(leaves)
    .where(and(...conditions))
    .limit(allParam === "true" ? 100 : 1);

  if (matchedLeaves.length === 0) {
    throw new NotFoundError("Proof");
  }

  const leaf = matchedLeaves[0];

  if (allParam === "true") {
    return jsonResponse({
      leaves: matchedLeaves.map((l) => ({
        leaf: {
          leafIndex: l.leafIndex,
          beneficiary: l.beneficiary,
          amount: l.amount,
          releaseType: l.releaseType,
          startTime: l.startTime,
          cliffTime: l.cliffTime,
          endTime: l.endTime,
          milestoneIdx: l.milestoneIdx,
        },
        proof: l.proof,
      })),
      merkleRoot: campaign.merkleRoot,
      treeAddress,
    });
  }

  return jsonResponse({
    leaf: {
      leafIndex: leaf.leafIndex,
      beneficiary: leaf.beneficiary,
      amount: leaf.amount,
      releaseType: leaf.releaseType,
      startTime: leaf.startTime,
      cliffTime: leaf.cliffTime,
      endTime: leaf.endTime,
      milestoneIdx: leaf.milestoneIdx,
    },
    proof: leaf.proof,
    merkleRoot: campaign.merkleRoot,
    treeAddress,
  });
}

export const GET = withRoute(
  { rateLimit: { requests: 60, window: 60 } },
  getProofHandler,
);
