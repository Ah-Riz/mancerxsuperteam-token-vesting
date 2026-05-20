import { describe, it, expect, vi } from "vitest";
import { derivePda } from "@/lib/anchor/client";
import { PublicKey, Keypair } from "@solana/web3.js";

vi.mock("@/hooks/useVestingProgram", () => ({
  useVestingProgram: vi.fn(() => null),
}));

function deterministicKey(seed: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[0] = seed;
  bytes[31] = seed + 1;
  return Keypair.fromSeed(bytes).publicKey;
}

const TREE_A = deterministicKey(1);
const TREE_B = deterministicKey(2);
const BEN_A = deterministicKey(3);
const BEN_B = deterministicKey(4);

describe("useClaimRecord — PDA derivation", () => {
  it("derives ClaimRecord PDA from tree + beneficiary", () => {
    const [pda] = derivePda([
      "claim",
      TREE_A.toBuffer(),
      BEN_A.toBuffer(),
    ]);
    expect(pda).toBeInstanceOf(PublicKey);
  });

  it("different beneficiaries produce different PDAs", () => {
    const [pda1] = derivePda(["claim", TREE_A.toBuffer(), BEN_A.toBuffer()]);
    const [pda2] = derivePda(["claim", TREE_A.toBuffer(), BEN_B.toBuffer()]);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it("different trees produce different PDAs", () => {
    const [pda1] = derivePda(["claim", TREE_A.toBuffer(), BEN_A.toBuffer()]);
    const [pda2] = derivePda(["claim", TREE_B.toBuffer(), BEN_A.toBuffer()]);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });
});
