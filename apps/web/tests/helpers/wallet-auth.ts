import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { generateNonce, storeNonce } from "@/lib/api/auth-middleware";
import { resetRedisForTests } from "@/lib/api/redis";
import { resetRateLimitForTests } from "@/lib/api/rate-limit";

export const TEST_CREATOR_KEYPAIR = Keypair.generate();

export async function createAuthHeader(
  wallet: Keypair = TEST_CREATOR_KEYPAIR,
): Promise<string> {
  resetRedisForTests();
  resetRateLimitForTests();
  const nonce = generateNonce();
  await storeNonce(nonce, "pending");

  const message = {
    nonce,
    timestamp: Date.now(),
    wallet: wallet.publicKey.toBase58(),
  };
  const messageBytes = Buffer.from(JSON.stringify(message), "utf8");
  const signature = nacl.sign.detached(messageBytes, wallet.secretKey);

  const token = `${Buffer.from(signature).toString("base64")}.${messageBytes.toString("base64")}`;
  return `Bearer ${token}`;
}
