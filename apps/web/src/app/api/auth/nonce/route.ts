import { NextResponse } from "next/server";
import { generateNonce, storeNonce } from "@/lib/api/auth-middleware";
import { withRoute } from "@/lib/api/route-wrapper";

const NONCE_TTL_MS = 5 * 60 * 1000;

async function getNonceHandler(): Promise<NextResponse> {
  const nonce = generateNonce();
  const expiresAt = Date.now() + NONCE_TTL_MS;

  // Wallet is bound when the client signs; store placeholder until auth completes.
  await storeNonce(nonce, "pending");

  return NextResponse.json({ nonce, expiresAt });
}

export const GET = withRoute(
  { rateLimit: { requests: 60, window: 60 } },
  getNonceHandler,
);
