import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { withRoute } from "@/lib/api/route-wrapper";
import { jsonResponse } from "@/lib/api/json-response";

const patchStatusSchema = z
  .object({
    paused: z.boolean().optional(),
    cancelledAt: z.number().nullable().optional(),
  })
  .refine((d) => d.paused !== undefined || d.cancelledAt !== undefined, {
    message: "No valid fields to update",
  });

async function patchCampaignStatusHandler(
  request: NextRequest,
  { params }: { params: Promise<{ treeAddress: string }> },
) {
  const { treeAddress } = await params;
  const body = await request.json();
  const parsed = patchStatusSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("No valid fields to update", parsed.error.issues);
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.paused !== undefined) updates.paused = parsed.data.paused;
  if (parsed.data.cancelledAt !== undefined) updates.cancelledAt = parsed.data.cancelledAt;

  const result = await db
    .update(campaigns)
    .set(updates)
    .where(eq(campaigns.treeAddress, treeAddress))
    .returning({ id: campaigns.id });

  if (result.length === 0) {
    throw new NotFoundError("Campaign");
  }

  return jsonResponse({ ok: true });
}

export const PATCH = withRoute(
  { auth: true, rateLimit: { requests: 10, window: 60 }, bodyLimit: "default" },
  patchCampaignStatusHandler,
);
