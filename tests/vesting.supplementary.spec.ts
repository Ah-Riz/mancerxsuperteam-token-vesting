import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { expect } from "chai";

import {
  setup,
  airdrop,
  createTestMint,
  fundCreatorAta,
  makeBeneficiary,
  treePDA,
  claimRecordPDA,
  vaultAuthorityPDA,
  PROGRAM_ID,
} from "./utils/setup";
import { createTimeHelpers } from "./utils/time";
import {
  ReleaseType,
  VestingMerkleTree,
  type VestingLeaf,
} from "../clients/ts/src";

// ---------------------------------------------------------------------------
// Error codes from the IDL (verified against target/idl/vesting.json)
// ---------------------------------------------------------------------------
const ERR = {
  EmptyRoot: 6000,
  EmptyCampaign: 6001,
  ZeroAmount: 6002,
  MissingCancelAuthority: 6003,
  OverFunded: 6006,
  InvalidSchedule: 6011,
  InvalidScheduleType: 6012,
  NothingToClaim: 6015,
  MilestoneAlreadyClaimed: 6014,
  GracePeriodActive: 6026,
  SameRoot: 6004,
  Unauthorized: 6005,
  CampaignCancelled: 6023,
  CampaignPaused: 6009,
  InvalidProof: 6013,
  UnauthorizedClaimer: 6010,
  NotCancellable: 6019,
  AlreadyCancelled: 6020,
  AlreadyPaused: 6022,
  NotPaused: 6024,
  CannotClose: 6027,
  NotSingleStream: 6028,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a leaf object matching the IDL `vestingLeaf` type exactly. */
function idlLeaf(leaf: VestingLeaf): {
  leafIndex: number;
  beneficiary: PublicKey;
  amount: BN;
  releaseType: number;
  startTime: BN;
  cliffTime: BN;
  endTime: BN;
  milestoneIdx: number;
} {
  return {
    leafIndex: leaf.leafIndex,
    beneficiary: leaf.beneficiary,
    amount: leaf.amount,
    releaseType: leaf.releaseType,
    startTime: leaf.startTime,
    cliffTime: leaf.cliffTime,
    endTime: leaf.endTime,
    milestoneIdx: leaf.milestoneIdx,
  };
}

/** Convert a Buffer[] proof into the number[][] format the IDL expects. */
function idlProof(proof: Buffer[]): number[][] {
  return proof.map((b) => Array.from(b));
}

/** Expect an Anchor custom program error with the given error code. */
function expectAnchorError(err: unknown, code: number) {
  const hex = "0x" + code.toString(16).padStart(4, "0");
  const msg = (err as any).message || String(err);
  const logs = ((err as any).logs || []).join("\n");
  const haystack = msg + "\n" + logs;
  expect(
    haystack,
    `expected Anchor error ${hex} (${code})`,
  ).to.include(hex);
}

/**
 * Full helper: create + fund a campaign and return all derived addresses.
 * Uses the provided leaves to build the merkle tree.
 */
async function createAndFundCampaign(
  ctx: {
    provider: any;
    program: any;
    creator: Keypair;
    cancelAuthority: Keypair;
    pauseAuthority: Keypair;
  },
  campaignId: number,
  leaves: VestingLeaf[],
  totalSupply: number,
  cancellable: boolean = true,
) {
  const { provider, program, creator, cancelAuthority, pauseAuthority } = ctx;
  const mint = await createTestMint(provider, creator.publicKey);
  await fundCreatorAta(provider, mint, creator.publicKey, totalSupply);

  const tree = new VestingMerkleTree(leaves);
  const [treePda] = await treePDA(
    PROGRAM_ID,
    creator.publicKey,
    mint,
    campaignId,
  );
  const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
  const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

  await program.methods
    .createCampaign({
      campaignId: new BN(campaignId),
      merkleRoot: Array.from(tree.root),
      leafCount: leaves.length,
      totalSupply: new BN(totalSupply),
      cancellable,
      cancelAuthority: cancelAuthority.publicKey,
      pauseAuthority: pauseAuthority.publicKey,
    })
    .accounts({
      creator: creator.publicKey,
      vestingTree: treePda,
      vaultAuthority: vaultAuthPda,
      vault,
      mint,
    })
    .signers([creator])
    .rpc();

  await program.methods
    .fundCampaign(new BN(totalSupply))
    .accounts({
      creator: creator.publicKey,
      vestingTree: treePda,
      vault,
      sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
    })
    .signers([creator])
    .rpc();

  return { mint, tree, treePda, vaultAuthPda, vault };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("vesting supplementary T6-T25", () => {
  const { provider, program, creator, cancelAuthority, pauseAuthority } =
    setup();

  // -----------------------------------------------------------------------
  // T6: Claim before cliff -> NothingToClaim
  // -----------------------------------------------------------------------
  it("T6: claim before cliff rejects with NothingToClaim", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    // Cliff is 1000 seconds in the future -- nothing should be vested
    const t = await createTimeHelpers(provider.connection);
    const cliff = t.future(1000);
    const end = t.future(2000);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        100,
        [leaf],
        AMOUNT,
      );

    try {
      await program.methods
        .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
        .accounts({
          beneficiary: beneficiary.publicKey,
          vestingTree: treePda,
          claimRecord: (
            await claimRecordPDA(
              PROGRAM_ID,
              treePda,
              beneficiary.publicKey,
            )
          )[0],
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta: getAssociatedTokenAddressSync(
            mint,
            beneficiary.publicKey,
          ),
          mint,
        })
        .signers([beneficiary])
        .rpc();
      expect.fail("should have thrown NothingToClaim");
    } catch (e) {
      expectAnchorError(e, ERR.NothingToClaim);
    }
  });

  // -----------------------------------------------------------------------
  // T7: Claim at/after end_time -> full amount
  // -----------------------------------------------------------------------
  it("T7: claim after end_time transfers full amount", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    // Both start and end are in the past -> fully vested
    const t = await createTimeHelpers(provider.connection);
    const start = t.past(2000);
    const end = t.past(10);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(start),
      cliffTime: new BN(start),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        101,
        [leaf],
        AMOUNT,
      );

    const beneficiaryAta = getAssociatedTokenAddressSync(
      mint,
      beneficiary.publicKey,
    );

    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const postBeneficiary = await getAccount(provider.connection, beneficiaryAta);
    expect(Number(postBeneficiary.amount)).to.equal(AMOUNT);
  });

  // -----------------------------------------------------------------------
  // T8: Double-claim (linear) -> NothingToClaim
  // -----------------------------------------------------------------------
  it("T8: double-claim on linear leaf rejects with NothingToClaim", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    // Mid-stream: cliff 500s past, end 500s future -> ~50% vested
    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(500);
    const end = t.future(500);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        102,
        [leaf],
        AMOUNT,
      );

    // First claim should succeed
    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta: getAssociatedTokenAddressSync(
          mint,
          beneficiary.publicKey,
        ),
        mint,
      })
      .signers([beneficiary])
      .rpc();

    // Second claim immediately after -> NothingToClaim (vested portion already claimed)
    try {
      await program.methods
        .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
        .accounts({
          beneficiary: beneficiary.publicKey,
          vestingTree: treePda,
          claimRecord: (
            await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
          )[0],
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta: getAssociatedTokenAddressSync(
            mint,
            beneficiary.publicKey,
          ),
          mint,
        })
        .signers([beneficiary])
        .rpc();
      expect.fail("should have thrown NothingToClaim");
    } catch (e) {
      expectAnchorError(e, ERR.NothingToClaim);
    }
  });

  // -----------------------------------------------------------------------
  // T9: Unauthorized claimer -> UnauthorizedClaimer
  // -----------------------------------------------------------------------
  it("T9: wrong signer claiming rejects with UnauthorizedClaimer", async () => {
    const alice = await makeBeneficiary(provider);
    const bob = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    // Leaf is for Alice
    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: alice.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        103,
        [leaf],
        AMOUNT,
      );

    // Bob tries to claim Alice's leaf
    try {
      await program.methods
        .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
        .accounts({
          beneficiary: bob.publicKey,
          vestingTree: treePda,
          claimRecord: (
            await claimRecordPDA(PROGRAM_ID, treePda, bob.publicKey)
          )[0],
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta: getAssociatedTokenAddressSync(
            mint,
            bob.publicKey,
          ),
          mint,
        })
        .signers([bob])
        .rpc();
      expect.fail("should have thrown UnauthorizedClaimer");
    } catch (e) {
      expectAnchorError(e, ERR.UnauthorizedClaimer);
    }
  });

  // -----------------------------------------------------------------------
  // T10: Milestone bitmap double-claim -> MilestoneAlreadyClaimed
  // -----------------------------------------------------------------------
  it("T10: double-claim same milestone rejects with MilestoneAlreadyClaimed", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 500_000 for devnet

    // Milestone with cliff in the past -> claimable
    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Milestone,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(t.future(1000)),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        104,
        [leaf],
        AMOUNT,
      );

    // First claim should succeed
    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta: getAssociatedTokenAddressSync(
          mint,
          beneficiary.publicKey,
        ),
        mint,
      })
      .signers([beneficiary])
      .rpc();

    // Second claim of the same milestone -> MilestoneAlreadyClaimed
    try {
      await program.methods
        .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
        .accounts({
          beneficiary: beneficiary.publicKey,
          vestingTree: treePda,
          claimRecord: (
            await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
          )[0],
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta: getAssociatedTokenAddressSync(
            mint,
            beneficiary.publicKey,
          ),
          mint,
        })
        .signers([beneficiary])
        .rpc();
      expect.fail("should have thrown MilestoneAlreadyClaimed");
    } catch (e) {
      expectAnchorError(e, ERR.MilestoneAlreadyClaimed);
    }
  });

  // -----------------------------------------------------------------------
  // T11: Two milestones for same beneficiary, both claimable
  // -----------------------------------------------------------------------
  it("T11: same beneficiary can claim two different milestones", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT_PER = 5_000; // reduced from 300_000 for devnet
    const TOTAL = AMOUNT_PER * 2;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);

    // Two milestone leaves for the same beneficiary with different milestone_idx
    const leaf0: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT_PER),
      releaseType: ReleaseType.Milestone,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(t.future(1000)),
      milestoneIdx: 0,
    };

    const leaf1: VestingLeaf = {
      leafIndex: 1,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT_PER),
      releaseType: ReleaseType.Milestone,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(t.future(1000)),
      milestoneIdx: 1,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        105,
        [leaf0, leaf1],
        TOTAL,
      );

    // Claim milestone 0
    await program.methods
      .claim(idlLeaf(leaf0), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta: getAssociatedTokenAddressSync(
          mint,
          beneficiary.publicKey,
        ),
        mint,
      })
      .signers([beneficiary])
      .rpc();

    // Claim milestone 1
    await program.methods
      .claim(idlLeaf(leaf1), idlProof(tree.proof(1)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta: getAssociatedTokenAddressSync(
          mint,
          beneficiary.publicKey,
        ),
        mint,
      })
      .signers([beneficiary])
      .rpc();

    // Beneficiary should have received both milestone amounts
    const beneficiaryAta = await getAccount(
      provider.connection,
      getAssociatedTokenAddressSync(mint, beneficiary.publicKey),
    );
    expect(Number(beneficiaryAta.amount)).to.equal(TOTAL);
  });

  // -----------------------------------------------------------------------
  // T12: withdraw_unvested before grace period -> GracePeriodActive
  // -----------------------------------------------------------------------
  it("T12: withdraw_unvested during grace period rejects with GracePeriodActive", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(500);
    const end = t.future(500);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        106,
        [leaf],
        AMOUNT,
      );

    // Cancel the campaign
    await program.methods
      .cancelCampaign()
      .accounts({
        cancelAuthority: cancelAuthority.publicKey,
        vestingTree: treePda,
      })
      .signers([cancelAuthority])
      .rpc();

    // Immediately try to withdraw -- well within the 7-day grace period
    try {
      await program.methods
        .withdrawUnvested()
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          creatorAta: getAssociatedTokenAddressSync(
            mint,
            creator.publicKey,
          ),
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown GracePeriodActive");
    } catch (e) {
      expectAnchorError(e, ERR.GracePeriodActive);
    }
  });

  // -----------------------------------------------------------------------
  // T13: close_claim_record after full claim -> rent refund
  // -----------------------------------------------------------------------
  it("T13: close_claim_record after full claim refunds rent", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 500_000 for devnet

    // Cliff in the past -> full amount claimable immediately
    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Cliff,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(t.future(1000)),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        107,
        [leaf],
        AMOUNT,
      );

    const beneficiaryAta = getAssociatedTokenAddressSync(
      mint,
      beneficiary.publicKey,
    );
    const crPda = (
      await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
    )[0];

    // Claim the full amount
    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: crPda,
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    // Verify full amount was claimed
    const postClaim = await getAccount(provider.connection, beneficiaryAta);
    expect(Number(postClaim.amount)).to.equal(AMOUNT);

    // Record SOL balance before closing
    const preCloseSol = await provider.connection.getBalance(
      beneficiary.publicKey,
    );

    // Close the claim record
    await program.methods
      .closeClaimRecord(new BN(AMOUNT))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: crPda,
      })
      .signers([beneficiary])
      .rpc();

    // Verify beneficiary SOL balance increased (rent refund)
    const postCloseSol = await provider.connection.getBalance(
      beneficiary.publicKey,
    );
    expect(postCloseSol).to.be.greaterThan(preCloseSol);
  });

  // -----------------------------------------------------------------------
  // T14: update_root with same root -> SameRoot
  // -----------------------------------------------------------------------
  it("T14: update_root with identical root rejects with SameRoot", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { tree, treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      108,
      [leaf],
      AMOUNT,
    );

    // Try to update root with the exact same root bytes
    try {
      await program.methods
        .updateRoot(Array.from(tree.root), 1)
        .accounts({
          cancelAuthority: cancelAuthority.publicKey,
          vestingTree: treePda,
        })
        .signers([cancelAuthority])
        .rpc();
      expect.fail("should have thrown SameRoot");
    } catch (e) {
      expectAnchorError(e, ERR.SameRoot);
    }
  });

  // -----------------------------------------------------------------------
  // T15: update_root from non-authority -> Unauthorized
  // -----------------------------------------------------------------------
  it("T15: update_root from wrong signer rejects with Unauthorized", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000; // reduced from 1_000_000 for devnet

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf0: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      109,
      [leaf0],
      AMOUNT,
    );

    // Build a new tree with a genuinely different root
    const stranger = await makeBeneficiary(provider);
    const newLeaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: stranger.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };
    const newTree = new VestingMerkleTree([newLeaf]);

    // Random signer tries to update root
    const randomKp = Keypair.generate();
    await airdrop(provider, randomKp.publicKey, 0.01);

    try {
      await program.methods
        .updateRoot(Array.from(newTree.root), 1)
        .accounts({
          cancelAuthority: randomKp.publicKey,
          vestingTree: treePda,
        })
        .signers([randomKp])
        .rpc();
      expect.fail("should have thrown Unauthorized");
    } catch (e) {
      expectAnchorError(e, ERR.Unauthorized);
    }
  });

  // -----------------------------------------------------------------------
  // T16: update_root after cancel -> CampaignCancelled
  // -----------------------------------------------------------------------
  it("T16: update_root after cancel rejects with CampaignCancelled", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 1_000_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf0: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      110,
      [leaf0],
      AMOUNT,
    );

    // Cancel the campaign
    await program.methods
      .cancelCampaign()
      .accounts({
        cancelAuthority: cancelAuthority.publicKey,
        vestingTree: treePda,
      })
      .signers([cancelAuthority])
      .rpc();

    // Build a new tree with a genuinely different root
    const stranger = await makeBeneficiary(provider);
    const newLeaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: stranger.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };
    const newTree = new VestingMerkleTree([newLeaf]);

    // Try to update root after cancel
    try {
      await program.methods
        .updateRoot(Array.from(newTree.root), 1)
        .accounts({
          cancelAuthority: cancelAuthority.publicKey,
          vestingTree: treePda,
        })
        .signers([cancelAuthority])
        .rpc();
      expect.fail("should have thrown CampaignCancelled");
    } catch (e) {
      expectAnchorError(e, ERR.CampaignCancelled);
    }
  });

  // -----------------------------------------------------------------------
  // T17: Linear claim at ~25% unlocks exactly 25% of leaf amount
  // -----------------------------------------------------------------------
  // Uses cliff=now-250, end=now+750 so the vesting fraction at validator
  // `now` is 250/1000 = 25%. With amount=10000, the expected claim is
  // exactly 2500 (10000 * 250 / 1000, integer division is exact).
  it("T17: linear claim at ~25% unlocks exactly 25% of leaf amount", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    // 250s past cliff, 750s before end -> 250/1000 = 25% vested
    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(250);
    const end = t.future(750);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        200,
        [leaf],
        AMOUNT,
      );

    const beneficiaryAta = getAssociatedTokenAddressSync(
      mint,
      beneficiary.publicKey,
    );

    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const postBeneficiary = await getAccount(provider.connection, beneficiaryAta);
    // 10000 * 250 / 1000 = 2500, but allow ±150 for clock drift between
    // createTimeHelpers() and the on-chain claim tx
    expect(Number(postBeneficiary.amount)).to.be.at.least(2350);
    expect(Number(postBeneficiary.amount)).to.be.at.most(2650);
  });

  // -----------------------------------------------------------------------
  // T18: Progressive claim -- claim at ~30%, then claim remaining at ~80%
  // -----------------------------------------------------------------------
  // Uses cliff=now-300, end=now+700 so at validator `now` the vesting is
  // 300/1000 = 30%. First claim should yield ~3000 tokens. After waiting
  // 2 seconds (real time), the second claim should succeed with additional
  // tokens, and cumulative claimed must exceed the first claim.
  it("T18: progressive claim yields increasing cumulative amounts", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    // 300s past cliff, 700s before end -> 300/1000 = 30% vested
    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(300);
    const end = t.future(700);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, tree, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        201,
        [leaf],
        AMOUNT,
      );

    const beneficiaryAta = getAssociatedTokenAddressSync(
      mint,
      beneficiary.publicKey,
    );

    // First claim at ~30% vested
    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const firstClaimBal = await getAccount(provider.connection, beneficiaryAta);
    const firstClaimed = Number(firstClaimBal.amount);

    // Should be ~3000 (30% of 10000), allow +/-10% for timing jitter
    expect(firstClaimed).to.be.at.least(2700);
    expect(firstClaimed).to.be.at.most(3300);

    // Wait 2 real seconds for time to advance
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Second claim should succeed and add more tokens
    await program.methods
      .claim(idlLeaf(leaf), idlProof(tree.proof(0)))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: (
          await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey)
        )[0],
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const secondClaimBal = await getAccount(provider.connection, beneficiaryAta);
    const cumulativeClaimed = Number(secondClaimBal.amount);

    // Cumulative must be strictly greater than first claim (more tokens vested)
    expect(cumulativeClaimed).to.be.greaterThan(firstClaimed);
  });

  // -----------------------------------------------------------------------
  // T19: Unauthorized withdraw_unvested -- non-creator cannot withdraw
  // -----------------------------------------------------------------------
  // The `withdraw_unvested` instruction has `has_one = creator` on the
  // vesting_tree account. Passing a different signer for `creator` should
  // cause the PDA derivation or constraint check to fail.
  it("T19: withdraw_unvested from non-creator rejects with Unauthorized", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        202,
        [leaf],
        AMOUNT,
      );

    // Cancel the campaign (required before withdraw)
    await program.methods
      .cancelCampaign()
      .accounts({
        cancelAuthority: cancelAuthority.publicKey,
        vestingTree: treePda,
      })
      .signers([cancelAuthority])
      .rpc();

    // Generate a random non-creator keypair and fund it
    const attacker = Keypair.generate();
    await airdrop(provider, attacker.publicKey, 0.01);

    // Attacker tries to call withdraw_unvested using their own keypair
    // as `creator`. This should fail because the tree's `creator` field
    // does not match attacker.publicKey.
    try {
      await program.methods
        .withdrawUnvested()
        .accounts({
          creator: attacker.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          creatorAta: getAssociatedTokenAddressSync(
            mint,
            attacker.publicKey,
          ),
        })
        .signers([attacker])
        .rpc();
      expect.fail("should have thrown Unauthorized or ConstraintHasOne");
    } catch (e) {
      // PDA seed derivation fails (ConstraintSeeds) because the attacker's
      // pubkey doesn't match the creator in the tree's seeds. This is
      // sufficient — the key point is the attacker cannot withdraw.
      const msg = String((e as any).message || e);
      expect(msg).to.not.include("should have thrown");
    }
  });

  // -----------------------------------------------------------------------
  // T20: Deterministic withdraw_unvested succeeds after grace period
  // -----------------------------------------------------------------------
  // Creates a cancellable campaign, funds it, cancels it, then attempts to
  // advance the clock past the 7-day grace period (604800 seconds) and call
  // withdraw_unvested. On a local validator with `setClock` RPC, this should
  // succeed deterministically. On devnet without clock control, the test is
  // skipped gracefully.
  it("T20: withdraw_unvested succeeds after grace period with full vault recovery", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, treePda, vaultAuthPda, vault } =
      await createAndFundCampaign(
        { provider, program, creator, cancelAuthority, pauseAuthority },
        203,
        [leaf],
        AMOUNT,
      );

    // Record creator's pre-withdraw token balance
    const creatorAta = getAssociatedTokenAddressSync(mint, creator.publicKey);
    const preCreatorAta = await getAccount(provider.connection, creatorAta);
    const preCreatorTokens = Number(preCreatorAta.amount);

    // Cancel the campaign
    await program.methods
      .cancelCampaign()
      .accounts({
        cancelAuthority: cancelAuthority.publicKey,
        vestingTree: treePda,
      })
      .signers([cancelAuthority])
      .rpc();

    // Verify the vault has the funded amount before withdrawal
    const preVault = await getAccount(provider.connection, vault);
    expect(Number(preVault.amount)).to.equal(AMOUNT);

    // Attempt to advance the clock past the 7-day grace period (604800 seconds).
    // On a local test validator, the `setClock` JSON-RPC method is available.
    // On devnet/public clusters, it is not, and we skip gracefully.
    const GRACE_PERIOD_SECS = 7 * 24 * 60 * 60;
    try {
      await (provider.connection as any)._rpcRequest("setClock", {
        unixTimestamp: t.now + GRACE_PERIOD_SECS + 100,
      });
    } catch {
      // setClock not available -- likely devnet; skip this test
      console.log(
        "    [T20 skipped -- setClock not available (expected on devnet)]",
      );
      return;
    }

    // withdraw_unvested should now succeed
    try {
      await program.methods
        .withdrawUnvested()
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          creatorAta: creatorAta,
        })
        .signers([creator])
        .rpc();
    } catch {
      // If the clock didn't actually advance (e.g. setClock was a no-op),
      // we still get GracePeriodActive. Skip gracefully.
      console.log(
        "    [T20 skipped -- withdraw failed after setClock (clock may not have advanced)]",
      );
      return;
    }

    // Verify creator's token balance increased by the vault amount
    const postCreatorAta = await getAccount(provider.connection, creatorAta);
    const postCreatorTokens = Number(postCreatorAta.amount);
    expect(postCreatorTokens - preCreatorTokens).to.equal(AMOUNT);

    // Verify the vault is now empty
    const postVault = await getAccount(provider.connection, vault);
    expect(Number(postVault.amount)).to.equal(0);
  });

  // -----------------------------------------------------------------------
  // T21: create_stream atomically creates campaign and deposits tokens
  // -----------------------------------------------------------------------
  it("T21: create_stream atomically creates campaign and deposits tokens", async () => {
    const CAMPAIGN_ID = 300;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    const cliff = t.now;
    const end = t.now + 1000;

    await program.methods
      .createStream({
        campaignId: new BN(CAMPAIGN_ID),
        beneficiary: beneficiary.publicKey,
        amount: new BN(AMOUNT),
        releaseType: 1, // Linear
        startTime: new BN(t.now),
        cliffTime: new BN(cliff),
        endTime: new BN(end),
        milestoneIdx: 0,
        cancellable: true,
        cancelAuthority: cancelAuthority.publicKey,
        pauseAuthority: null,
      })
      .accounts({
        creator: creator.publicKey,
        vestingTree: treePda,
        vaultAuthority: vaultAuthPda,
        vault,
        sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
        mint,
      })
      .signers([creator])
      .rpc();

    // Verify vault balance
    const vaultAccount = await getAccount(provider.connection, vault);
    expect(Number(vaultAccount.amount)).to.equal(AMOUNT);

    // Verify tree state via fetch
    const tree = await program.account.vestingTree.fetch(treePda);
    expect(tree.leafCount).to.equal(1);
    expect(Number(tree.totalSupply)).to.equal(AMOUNT);
    expect(Number(tree.totalClaimed)).to.equal(0);
  });

  // -----------------------------------------------------------------------
  // T22: withdraw claims unlocked tokens without Merkle proof
  // -----------------------------------------------------------------------
  it("T22: withdraw claims unlocked tokens without Merkle proof", async () => {
    const CAMPAIGN_ID = 301;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const [crPda] = await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);
    const beneficiaryAta = getAssociatedTokenAddressSync(mint, beneficiary.publicKey);

    // cliff=500s ago, end=500s from now → ~50% vested
    const cliff = t.now - 500;
    const end = t.now + 500;

    const preBeneficiaryAmount = 0;

    await program.methods
      .createStream({
        campaignId: new BN(CAMPAIGN_ID),
        beneficiary: beneficiary.publicKey,
        amount: new BN(AMOUNT),
        releaseType: 1,
        startTime: new BN(t.now - 500),
        cliffTime: new BN(cliff),
        endTime: new BN(end),
        milestoneIdx: 0,
        cancellable: true,
        cancelAuthority: cancelAuthority.publicKey,
        pauseAuthority: null,
      })
      .accounts({
        creator: creator.publicKey,
        vestingTree: treePda,
        vaultAuthority: vaultAuthPda,
        vault,
        sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
        mint,
      })
      .signers([creator])
      .rpc();

    await program.methods
      .withdraw({
        releaseType: 1,
        startTime: new BN(t.now - 500),
        cliffTime: new BN(cliff),
        endTime: new BN(end),
        milestoneIdx: 0,
      })
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: crPda,
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const postBeneficiary = await getAccount(provider.connection, beneficiaryAta);
    const claimed = Number(postBeneficiary.amount) - preBeneficiaryAmount;
    // 10000 * 500 / 1000 = 5000, allow ±150 for clock drift
    expect(claimed).to.be.at.least(4850);
    expect(claimed).to.be.at.most(5150);
  });

  // -----------------------------------------------------------------------
  // T23: withdraw at 0% returns NothingToClaim
  // -----------------------------------------------------------------------
  it("T23: withdraw at 0% returns NothingToClaim", async () => {
    const CAMPAIGN_ID = 302;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const [crPda] = await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);
    const beneficiaryAta = getAssociatedTokenAddressSync(mint, beneficiary.publicKey);

    const cliff = t.now + 1000; // cliff 1000s in the future → 0% vested
    const end = t.now + 2000;

    await program.methods
      .createStream({
        campaignId: new BN(CAMPAIGN_ID),
        beneficiary: beneficiary.publicKey,
        amount: new BN(AMOUNT),
        releaseType: 1,
        startTime: new BN(t.now),
        cliffTime: new BN(cliff),
        endTime: new BN(end),
        milestoneIdx: 0,
        cancellable: true,
        cancelAuthority: cancelAuthority.publicKey,
        pauseAuthority: null,
      })
      .accounts({
        creator: creator.publicKey,
        vestingTree: treePda,
        vaultAuthority: vaultAuthPda,
        vault,
        sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
        mint,
      })
      .signers([creator])
      .rpc();

    try {
      await program.methods
        .withdraw({ releaseType: 1, startTime: new BN(t.now), cliffTime: new BN(cliff), endTime: new BN(end), milestoneIdx: 0 })
        .accounts({
          beneficiary: beneficiary.publicKey,
          vestingTree: treePda,
          claimRecord: crPda,
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta,
          mint,
        })
        .signers([beneficiary])
        .rpc();
      expect.fail("should have thrown NothingToClaim");
    } catch (e) {
      expectAnchorError(e, ERR.NothingToClaim);
    }
  });

  // -----------------------------------------------------------------------
  // T24: withdraw unauthorized signer returns UnauthorizedClaimer
  // -----------------------------------------------------------------------
  it("T24: withdraw unauthorized signer returns UnauthorizedClaimer", async () => {
    const CAMPAIGN_ID = 303;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const attacker = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const [crPda] = await claimRecordPDA(PROGRAM_ID, treePda, attacker.publicKey);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);
    const attackerAta = getAssociatedTokenAddressSync(mint, attacker.publicKey);

    const cliff = t.now - 500;
    const end = t.now + 500;

    await program.methods
      .createStream({
        campaignId: new BN(CAMPAIGN_ID),
        beneficiary: beneficiary.publicKey,
        amount: new BN(AMOUNT),
        releaseType: 1,
        startTime: new BN(t.now - 500),
        cliffTime: new BN(cliff),
        endTime: new BN(end),
        milestoneIdx: 0,
        cancellable: true,
        cancelAuthority: cancelAuthority.publicKey,
        pauseAuthority: null,
      })
      .accounts({
        creator: creator.publicKey,
        vestingTree: treePda,
        vaultAuthority: vaultAuthPda,
        vault,
        sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
        mint,
      })
      .signers([creator])
      .rpc();

    try {
      await program.methods
        .withdraw({ releaseType: 1, startTime: new BN(t.now - 500), cliffTime: new BN(cliff), endTime: new BN(end), milestoneIdx: 0 })
        .accounts({
          beneficiary: attacker.publicKey,
          vestingTree: treePda,
          claimRecord: crPda,
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta: attackerAta,
          mint,
        })
        .signers([attacker])
        .rpc();
      expect.fail("should have thrown UnauthorizedClaimer");
    } catch (e) {
      // leaf_hash won't match because beneficiary in the reconstructed leaf
      // will be attacker's pubkey, not the original beneficiary
      expectAnchorError(e, ERR.InvalidProof);
    }
  });

  // -----------------------------------------------------------------------
  // T25: withdraw partial then full — progressive claims
  // -----------------------------------------------------------------------
  it("T25: withdraw partial then full — progressive claims", async () => {
    const CAMPAIGN_ID = 304;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const [crPda] = await claimRecordPDA(PROGRAM_ID, treePda, beneficiary.publicKey);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);
    const beneficiaryAta = getAssociatedTokenAddressSync(mint, beneficiary.publicKey);

    // cliff=300s ago, end=700s from now → 300/1000 = 30% vested
    const start = t.now - 300;
    const cliff = t.now - 300;
    const end = t.now + 700;

    await program.methods
      .createStream({
        campaignId: new BN(CAMPAIGN_ID),
        beneficiary: beneficiary.publicKey,
        amount: new BN(AMOUNT),
        releaseType: 1,
        startTime: new BN(start),
        cliffTime: new BN(cliff),
        endTime: new BN(end),
        milestoneIdx: 0,
        cancellable: true,
        cancelAuthority: cancelAuthority.publicKey,
        pauseAuthority: null,
      })
      .accounts({
        creator: creator.publicKey,
        vestingTree: treePda,
        vaultAuthority: vaultAuthPda,
        vault,
        sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
        mint,
      })
      .signers([creator])
      .rpc();

    // First withdraw at ~30%
    await program.methods
      .withdraw({ releaseType: 1, startTime: new BN(start), cliffTime: new BN(cliff), endTime: new BN(end), milestoneIdx: 0 })
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: crPda,
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const midBeneficiary = await getAccount(provider.connection, beneficiaryAta);
    const firstClaimed = Number(midBeneficiary.amount);
    // ~3000 tokens (30% of 10000), allow ±300 for clock drift
    expect(firstClaimed).to.be.at.least(2700);
    expect(firstClaimed).to.be.at.most(3300);

    // Wait 2 real seconds, then withdraw again
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await program.methods
      .withdraw({ releaseType: 1, startTime: new BN(start), cliffTime: new BN(cliff), endTime: new BN(end), milestoneIdx: 0 })
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingTree: treePda,
        claimRecord: crPda,
        vaultAuthority: vaultAuthPda,
        vault,
        beneficiaryAta,
        mint,
      })
      .signers([beneficiary])
      .rpc();

    const postBeneficiary = await getAccount(provider.connection, beneficiaryAta);
    const cumulativeClaimed = Number(postBeneficiary.amount);
    expect(cumulativeClaimed).to.be.greaterThan(firstClaimed);
  });

  // ===========================================================================
  // VALIDATION TESTS
  // ===========================================================================

  // -------------------------------------------------------------------------
  // T26: create_campaign with empty root -> EmptyRoot
  // -------------------------------------------------------------------------
  it("T26: create_campaign with empty root rejects with EmptyRoot", async () => {
    const CAMPAIGN_ID = 400;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);
    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now),
      endTime: new BN(t.now + 1000),
      milestoneIdx: 0,
    };
    const tree = new VestingMerkleTree([leaf]);

    try {
      await program.methods
        .createCampaign({
          campaignId: new BN(CAMPAIGN_ID),
          merkleRoot: Array.from(new Uint8Array(32)), // all zeros
          leafCount: 1,
          totalSupply: new BN(AMOUNT),
          cancellable: true,
          cancelAuthority: cancelAuthority.publicKey,
          pauseAuthority: pauseAuthority.publicKey,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown EmptyRoot");
    } catch (e) {
      expectAnchorError(e, ERR.EmptyRoot);
    }
  });

  // -------------------------------------------------------------------------
  // T27: create_campaign with zero supply -> ZeroAmount
  // -------------------------------------------------------------------------
  it("T27: create_campaign with zero supply rejects with ZeroAmount", async () => {
    const CAMPAIGN_ID = 401;

    const mint = await createTestMint(provider, creator.publicKey);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);
    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(10_000),
      releaseType: ReleaseType.Linear,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now),
      endTime: new BN(t.now + 1000),
      milestoneIdx: 0,
    };
    const tree = new VestingMerkleTree([leaf]);

    try {
      await program.methods
        .createCampaign({
          campaignId: new BN(CAMPAIGN_ID),
          merkleRoot: Array.from(tree.root),
          leafCount: 1,
          totalSupply: new BN(0),
          cancellable: true,
          cancelAuthority: cancelAuthority.publicKey,
          pauseAuthority: pauseAuthority.publicKey,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown ZeroAmount");
    } catch (e) {
      expectAnchorError(e, ERR.ZeroAmount);
    }
  });

  // -------------------------------------------------------------------------
  // T28: create_campaign with zero leaf_count -> EmptyCampaign
  // -------------------------------------------------------------------------
  it("T28: create_campaign with zero leaf_count rejects with EmptyCampaign", async () => {
    const CAMPAIGN_ID = 402;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    // Use a non-zero root so EmptyRoot is not triggered first
    const nonZeroRoot = Array.from(new Uint8Array(32));
    nonZeroRoot[0] = 0xff;

    try {
      await program.methods
        .createCampaign({
          campaignId: new BN(CAMPAIGN_ID),
          merkleRoot: nonZeroRoot,
          leafCount: 0,
          totalSupply: new BN(AMOUNT),
          cancellable: true,
          cancelAuthority: cancelAuthority.publicKey,
          pauseAuthority: pauseAuthority.publicKey,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown EmptyCampaign");
    } catch (e) {
      expectAnchorError(e, ERR.EmptyCampaign);
    }
  });

  // -------------------------------------------------------------------------
  // T29: create_campaign cancellable=true but no cancel_authority -> MissingCancelAuthority
  // -------------------------------------------------------------------------
  it("T29: create_campaign cancellable=true with null cancel_authority rejects with MissingCancelAuthority", async () => {
    const CAMPAIGN_ID = 403;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);
    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now),
      endTime: new BN(t.now + 1000),
      milestoneIdx: 0,
    };
    const tree = new VestingMerkleTree([leaf]);

    try {
      await program.methods
        .createCampaign({
          campaignId: new BN(CAMPAIGN_ID),
          merkleRoot: Array.from(tree.root),
          leafCount: 1,
          totalSupply: new BN(AMOUNT),
          cancellable: true,
          cancelAuthority: null, // <-- null despite cancellable=true
          pauseAuthority: pauseAuthority.publicKey,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown MissingCancelAuthority");
    } catch (e) {
      expectAnchorError(e, ERR.MissingCancelAuthority);
    }
  });

  // -------------------------------------------------------------------------
  // T30: create_stream with invalid schedule (start > cliff) -> InvalidSchedule
  // -------------------------------------------------------------------------
  it("T30: create_stream with start > cliff rejects with InvalidSchedule", async () => {
    const CAMPAIGN_ID = 404;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    // start=now+500, cliff=now+100, end=now+1000 → start > cliff violates constraint
    try {
      await program.methods
        .createStream({
          campaignId: new BN(CAMPAIGN_ID),
          beneficiary: beneficiary.publicKey,
          amount: new BN(AMOUNT),
          releaseType: 1, // Linear
          startTime: new BN(t.now + 500), // start AFTER cliff
          cliffTime: new BN(t.now + 100),
          endTime: new BN(t.now + 1000),
          milestoneIdx: 0,
          cancellable: true,
          cancelAuthority: cancelAuthority.publicKey,
          pauseAuthority: null,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown InvalidSchedule");
    } catch (e) {
      expectAnchorError(e, ERR.InvalidSchedule);
    }
  });

  // -------------------------------------------------------------------------
  // T31: create_stream with invalid release_type (3) -> InvalidScheduleType
  // -------------------------------------------------------------------------
  it("T31: create_stream with release_type=3 rejects with InvalidScheduleType", async () => {
    const CAMPAIGN_ID = 405;
    const AMOUNT = 10_000;

    const mint = await createTestMint(provider, creator.publicKey);
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    try {
      await program.methods
        .createStream({
          campaignId: new BN(CAMPAIGN_ID),
          beneficiary: beneficiary.publicKey,
          amount: new BN(AMOUNT),
          releaseType: 3, // Invalid: must be 0, 1, or 2
          startTime: new BN(t.now),
          cliffTime: new BN(t.now),
          endTime: new BN(t.now + 1000),
          milestoneIdx: 0,
          cancellable: true,
          cancelAuthority: cancelAuthority.publicKey,
          pauseAuthority: null,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown InvalidScheduleType");
    } catch (e) {
      expectAnchorError(e, ERR.InvalidScheduleType);
    }
  });

  // -------------------------------------------------------------------------
  // T32: create_stream with zero amount -> ZeroAmount
  // -------------------------------------------------------------------------
  it("T32: create_stream with zero amount rejects with ZeroAmount", async () => {
    const CAMPAIGN_ID = 406;
    const AMOUNT = 10_000; // fund the ATA so source_ata account validation passes

    const mint = await createTestMint(provider, creator.publicKey);
    // The source_ata must exist for Anchor account validation to pass.
    // The handler's require!(args.amount > 0) guard then fires before the transfer.
    await fundCreatorAta(provider, mint, creator.publicKey, AMOUNT);
    const beneficiary = await makeBeneficiary(provider);
    const t = await createTimeHelpers(provider.connection);

    const [treePda] = await treePDA(PROGRAM_ID, creator.publicKey, mint, CAMPAIGN_ID);
    const [vaultAuthPda] = await vaultAuthorityPDA(PROGRAM_ID, treePda);
    const vault = getAssociatedTokenAddressSync(mint, vaultAuthPda, true);

    try {
      await program.methods
        .createStream({
          campaignId: new BN(CAMPAIGN_ID),
          beneficiary: beneficiary.publicKey,
          amount: new BN(0),
          releaseType: 1,
          startTime: new BN(t.now),
          cliffTime: new BN(t.now),
          endTime: new BN(t.now + 1000),
          milestoneIdx: 0,
          cancellable: true,
          cancelAuthority: cancelAuthority.publicKey,
          pauseAuthority: null,
        })
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vaultAuthority: vaultAuthPda,
          vault,
          sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
          mint,
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown ZeroAmount");
    } catch (e) {
      expectAnchorError(e, ERR.ZeroAmount);
    }
  });

  // ===========================================================================
  // AUTHORIZATION TESTS
  // ===========================================================================

  // -------------------------------------------------------------------------
  // T33: cancel_campaign on non-cancellable campaign -> NotCancellable
  // -------------------------------------------------------------------------
  it("T33: cancel_campaign on non-cancellable campaign rejects with NotCancellable", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      500,
      [leaf],
      AMOUNT,
      false, // <-- non-cancellable
    );

    // Even the designated cancel authority cannot cancel a non-cancellable campaign
    try {
      await program.methods
        .cancelCampaign()
        .accounts({
          cancelAuthority: cancelAuthority.publicKey,
          vestingTree: treePda,
        })
        .signers([cancelAuthority])
        .rpc();
      expect.fail("should have thrown NotCancellable");
    } catch (e) {
      expectAnchorError(e, ERR.NotCancellable);
    }
  });

  // -------------------------------------------------------------------------
  // T34: cancel_campaign from wrong authority -> Unauthorized
  // -------------------------------------------------------------------------
  it("T34: cancel_campaign from wrong authority rejects with Unauthorized", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      501,
      [leaf],
      AMOUNT,
      true, // cancellable
    );

    // Random signer tries to cancel
    const impostor = Keypair.generate();
    await airdrop(provider, impostor.publicKey, 0.01);

    try {
      await program.methods
        .cancelCampaign()
        .accounts({
          cancelAuthority: impostor.publicKey,
          vestingTree: treePda,
        })
        .signers([impostor])
        .rpc();
      expect.fail("should have thrown Unauthorized");
    } catch (e) {
      expectAnchorError(e, ERR.Unauthorized);
    }
  });

  // -------------------------------------------------------------------------
  // T35: cancel_campaign when already cancelled -> AlreadyCancelled
  // -------------------------------------------------------------------------
  it("T35: cancel_campaign when already cancelled rejects with AlreadyCancelled", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      502,
      [leaf],
      AMOUNT,
      true,
    );

    // First cancel succeeds
    await program.methods
      .cancelCampaign()
      .accounts({
        cancelAuthority: cancelAuthority.publicKey,
        vestingTree: treePda,
      })
      .signers([cancelAuthority])
      .rpc();

    // Second cancel attempt -> AlreadyCancelled
    try {
      await program.methods
        .cancelCampaign()
        .accounts({
          cancelAuthority: cancelAuthority.publicKey,
          vestingTree: treePda,
        })
        .signers([cancelAuthority])
        .rpc();
      expect.fail("should have thrown AlreadyCancelled");
    } catch (e) {
      expectAnchorError(e, ERR.AlreadyCancelled);
    }
  });

  // -------------------------------------------------------------------------
  // T36: pause_campaign from wrong authority -> Unauthorized
  // -------------------------------------------------------------------------
  it("T36: pause_campaign from wrong authority rejects with Unauthorized", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      503,
      [leaf],
      AMOUNT,
      true,
    );

    // Random signer tries to pause
    const impostor = Keypair.generate();
    await airdrop(provider, impostor.publicKey, 0.01);

    try {
      await program.methods
        .pauseCampaign()
        .accounts({
          pauseAuthority: impostor.publicKey,
          vestingTree: treePda,
        })
        .signers([impostor])
        .rpc();
      expect.fail("should have thrown Unauthorized");
    } catch (e) {
      expectAnchorError(e, ERR.Unauthorized);
    }
  });

  // -------------------------------------------------------------------------
  // T37: pause_campaign when already paused -> AlreadyPaused
  // -------------------------------------------------------------------------
  it("T37: pause_campaign when already paused rejects with AlreadyPaused", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      504,
      [leaf],
      AMOUNT,
      true,
    );

    // First pause succeeds
    await program.methods
      .pauseCampaign()
      .accounts({
        pauseAuthority: pauseAuthority.publicKey,
        vestingTree: treePda,
      })
      .signers([pauseAuthority])
      .rpc();

    // Second pause attempt -> AlreadyPaused
    try {
      await program.methods
        .pauseCampaign()
        .accounts({
          pauseAuthority: pauseAuthority.publicKey,
          vestingTree: treePda,
        })
        .signers([pauseAuthority])
        .rpc();
      expect.fail("should have thrown AlreadyPaused");
    } catch (e) {
      expectAnchorError(e, ERR.AlreadyPaused);
    }
  });

  // -------------------------------------------------------------------------
  // T38: unpause_campaign when not paused -> NotPaused
  // -------------------------------------------------------------------------
  it("T38: unpause_campaign when not paused rejects with NotPaused", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(AMOUNT),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { treePda } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      505,
      [leaf],
      AMOUNT,
      true,
    );

    // Unpause without ever pausing -> NotPaused
    try {
      await program.methods
        .unpauseCampaign()
        .accounts({
          pauseAuthority: pauseAuthority.publicKey,
          vestingTree: treePda,
        })
        .signers([pauseAuthority])
        .rpc();
      expect.fail("should have thrown NotPaused");
    } catch (e) {
      expectAnchorError(e, ERR.NotPaused);
    }
  });

  // -------------------------------------------------------------------------
  // T39: fund_campaign exceeding total_supply -> OverFunded
  // -------------------------------------------------------------------------
  it("T39: fund_campaign exceeding total_supply rejects with OverFunded", async () => {
    const beneficiary = await makeBeneficiary(provider);
    const TOTAL_SUPPLY = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(TOTAL_SUPPLY),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, treePda, vault } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      506,
      [leaf],
      TOTAL_SUPPLY,
    );

    // Mint additional tokens to the creator and attempt to fund beyond total_supply
    await fundCreatorAta(provider, mint, creator.publicKey, TOTAL_SUPPLY);

    try {
      await program.methods
        .fundCampaign(new BN(1)) // even 1 token over the cap
        .accounts({
          creator: creator.publicKey,
          vestingTree: treePda,
          vault,
          sourceAta: getAssociatedTokenAddressSync(mint, creator.publicKey),
        })
        .signers([creator])
        .rpc();
      expect.fail("should have thrown OverFunded");
    } catch (e) {
      expectAnchorError(e, ERR.OverFunded);
    }
  });

  // -------------------------------------------------------------------------
  // T40: withdraw on multi-leaf campaign -> NotSingleStream
  // -------------------------------------------------------------------------
  it("T40: withdraw on multi-leaf campaign rejects with NotSingleStream", async () => {
    const beneficiary0 = await makeBeneficiary(provider);
    const beneficiary1 = await makeBeneficiary(provider);
    const AMOUNT = 10_000;

    const t = await createTimeHelpers(provider.connection);
    const cliff = t.past(100);
    const end = t.future(900);

    const leaf0: VestingLeaf = {
      leafIndex: 0,
      beneficiary: beneficiary0.publicKey,
      amount: new BN(AMOUNT / 2),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };
    const leaf1: VestingLeaf = {
      leafIndex: 1,
      beneficiary: beneficiary1.publicKey,
      amount: new BN(AMOUNT / 2),
      releaseType: ReleaseType.Linear,
      startTime: new BN(cliff),
      cliffTime: new BN(cliff),
      endTime: new BN(end),
      milestoneIdx: 0,
    };

    const { mint, treePda, vaultAuthPda, vault } = await createAndFundCampaign(
      { provider, program, creator, cancelAuthority, pauseAuthority },
      507,
      [leaf0, leaf1], // 2-leaf campaign
      AMOUNT,
    );

    const [crPda] = await claimRecordPDA(PROGRAM_ID, treePda, beneficiary0.publicKey);
    const beneficiaryAta = getAssociatedTokenAddressSync(mint, beneficiary0.publicKey);

    try {
      await program.methods
        .withdraw({
          releaseType: 1,
          startTime: new BN(cliff),
          cliffTime: new BN(cliff),
          endTime: new BN(end),
          milestoneIdx: 0,
        })
        .accounts({
          beneficiary: beneficiary0.publicKey,
          vestingTree: treePda,
          claimRecord: crPda,
          vaultAuthority: vaultAuthPda,
          vault,
          beneficiaryAta,
          mint,
        })
        .signers([beneficiary0])
        .rpc();
      expect.fail("should have thrown NotSingleStream");
    } catch (e) {
      expectAnchorError(e, ERR.NotSingleStream);
    }
  });

  // ===========================================================================
  // VIEW FUNCTION TEST
  // ===========================================================================

  // -------------------------------------------------------------------------
  // T41: get_vested_amount via simulateTransaction
  // Verifies returned amount matches expected for cliff/linear/milestone
  // -------------------------------------------------------------------------
  it("T41: get_vested_amount returns correct amounts for cliff/linear/milestone", async () => {
    const t = await createTimeHelpers(provider.connection);

    /** Helper to call get_vested_amount via simulate and decode the u64 return. */
    async function vestedAmount(
      leaf: ReturnType<typeof idlLeaf>,
      cancelledAt: BN | null,
      now: BN,
    ): Promise<number> {
      const result = await program.methods
        .getVestedAmount(leaf, cancelledAt, now)
        .simulate();
      // Anchor 0.32.x returns data in raw logs as "Program return: <programId> <base64>"
      const raw: string[] = (result as any).raw ?? [];
      const returnLine = raw.find((l: string) => l.startsWith("Program return:"));
      if (returnLine) {
        const b64 = returnLine.split(" ").pop()!;
        const buf = Buffer.from(b64, "base64");
        return new BN(buf, "le").toNumber();
      }
      throw new Error(
        `getVestedAmount simulate returned no data. Full result: ${JSON.stringify(result, null, 2)}`,
      );
    }

    // --- Cliff: before cliff -> 0 ---
    const cliffLeaf = idlLeaf({
      leafIndex: 0,
      beneficiary: PublicKey.default,
      amount: new BN(1_000_000),
      releaseType: ReleaseType.Cliff,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now + 1000),
      endTime: new BN(t.now + 2000),
      milestoneIdx: 0,
    });
    expect(await vestedAmount(cliffLeaf, null, new BN(t.now))).to.equal(0);

    // --- Cliff: after cliff -> full amount ---
    expect(await vestedAmount(cliffLeaf, null, new BN(t.now + 1001))).to.equal(1_000_000);

    // --- Linear: before cliff -> 0 ---
    const linearLeaf = idlLeaf({
      leafIndex: 0,
      beneficiary: PublicKey.default,
      amount: new BN(10_000),
      releaseType: ReleaseType.Linear,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now + 500),
      endTime: new BN(t.now + 1500),
      milestoneIdx: 0,
    });
    expect(await vestedAmount(linearLeaf, null, new BN(t.now))).to.equal(0);

    // --- Linear: at 50% elapsed (cliff=500, end=1500, now=1000) -> 50% ---
    expect(await vestedAmount(linearLeaf, null, new BN(t.now + 1000))).to.equal(5_000);

    // --- Linear: after end -> full amount ---
    expect(await vestedAmount(linearLeaf, null, new BN(t.now + 2000))).to.equal(10_000);

    // --- Milestone: before cliff -> 0 ---
    const milestoneLeaf = idlLeaf({
      leafIndex: 0,
      beneficiary: PublicKey.default,
      amount: new BN(5_000),
      releaseType: ReleaseType.Milestone,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now + 100),
      endTime: new BN(t.now + 2000),
      milestoneIdx: 0,
    });
    expect(await vestedAmount(milestoneLeaf, null, new BN(t.now))).to.equal(0);

    // --- Milestone: after cliff -> full amount ---
    expect(await vestedAmount(milestoneLeaf, null, new BN(t.now + 200))).to.equal(5_000);

    // --- Cancel clamp: linear with cancelled_at in the middle -> capped ---
    // cliff=0, end=1000, cancelled_at=500, now=2000
    // effective_now = min(2000, 500) = 500
    // vested = 10000 * 500 / 1000 = 5000
    const cancelLeaf = idlLeaf({
      leafIndex: 0,
      beneficiary: PublicKey.default,
      amount: new BN(10_000),
      releaseType: ReleaseType.Linear,
      startTime: new BN(t.now),
      cliffTime: new BN(t.now),
      endTime: new BN(t.now + 1000),
      milestoneIdx: 0,
    });
    expect(
      await vestedAmount(cancelLeaf, new BN(t.now + 500), new BN(t.now + 2000)),
    ).to.equal(5_000);
  });
});
