import { Connection } from "@solana/web3.js";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorHandler } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/json-response";

const CHECK_TIMEOUT_MS = 5000;
const VERSION = process.env.npm_package_version ?? "0.0.0";

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);
}

async function checkDatabase(): Promise<boolean> {
  try {
    await withTimeout(db.execute(sql`SELECT 1`), CHECK_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

async function checkRpc(): Promise<boolean> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (!rpcUrl) return false;

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    await withTimeout(connection.getSlot(), CHECK_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

async function healthHandler(): Promise<NextResponse> {
  const [dbOk, rpcOk] = await Promise.all([checkDatabase(), checkRpc()]);
  const healthy = dbOk && rpcOk;
  const status = healthy ? "ok" : dbOk || rpcOk ? "degraded" : "down";

  const body = {
    status,
    db: dbOk,
    rpc: rpcOk,
    version: VERSION,
    timestamp: Date.now(),
  };

  return jsonResponse(body, { status: healthy ? 200 : 503 });
}

export const GET = errorHandler(healthHandler);
