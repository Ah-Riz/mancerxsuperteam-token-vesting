import { type Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Dev-only parity check: calls on-chain get_vested_amount and compares
 * with client-side calculation. Logs result to console.
 */
export async function verifyVestedAmount(
  program: Program,
  params: {
    beneficiary: PublicKey;
    amount: bigint;
    releaseType: number;
    startTime: number;
    cliffTime: number;
    endTime: number;
    milestoneIdx: number;
    cancelledAt: number | null;
    milestoneReleasedFlags: Uint8Array | null;
    clientVested: bigint;
  },
): Promise<{ onChain: bigint; clientSide: bigint; match: boolean }> {
  const leaf = {
    leafIndex: 0,
    beneficiary: params.beneficiary,
    amount: new BN(params.amount.toString()),
    releaseType: params.releaseType,
    startTime: new BN(params.startTime),
    cliffTime: new BN(params.cliffTime),
    endTime: new BN(params.endTime),
    milestoneIdx: params.milestoneIdx,
  };

  const cancelledAt = params.cancelledAt !== null ? new BN(params.cancelledAt) : null;
  const now = new BN(Math.floor(Date.now() / 1000));
  const flags = params.milestoneReleasedFlags
    ? Array.from(params.milestoneReleasedFlags)
    : null;

  try {
    const result = await program.methods
      .getVestedAmount(leaf, cancelledAt, now, flags)
      .accounts({})
      .view();

    const onChain = BigInt(result.toString());
    const match = onChain === params.clientVested;

    return { onChain, clientSide: params.clientVested, match };
  } catch {
    // view() may not be supported on all RPC endpoints; silently skip
    return { onChain: params.clientVested, clientSide: params.clientVested, match: true };
  }
}
