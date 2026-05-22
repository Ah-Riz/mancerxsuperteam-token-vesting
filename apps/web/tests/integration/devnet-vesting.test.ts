import { describe, expect, it, beforeAll } from "vitest";
import { Keypair } from "@solana/web3.js";
import { VESTING_ERROR_CODES } from "@/lib/anchor/errors";
import {
  cancelStream,
  claimSingleStream,
  createSingleStreamFixture,
  currentUnix,
  ensureSol,
  expectErrorCode,
  fetchClaimRecord,
  fetchTree,
  getDevnetConnection,
  loadKeypairFromEnv,
  makeProgram,
  pauseStream,
  setMilestoneReleased,
  tokenBalance,
  uiAmountToRaw,
} from "./devnet-helpers";

const hasDevnetKeypair = Boolean(process.env.DEVNET_KEYPAIR);
const describeDevnet = hasDevnetKeypair ? describe : describe.skip;
const TEST_TIMEOUT = 180_000;

describeDevnet("devnet vesting flows", () => {
  const connection = getDevnetConnection();
  let creator!: Keypair;

  beforeAll(async () => {
    creator = loadKeypairFromEnv();
    await ensureSol(connection, creator);
  }, TEST_TIMEOUT);

  it("cliff: create with cliff in the past yields valid state", async () => {
    const now = currentUnix();
    const beneficiary = creator;
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(1000),
      releaseType: 0,
      startTime: now - 300,
      cliffTime: now - 120,
      endTime: now - 120,
      milestoneIdx: 0,
    });

    const tree = await fetchTree(connection, fixture.treePubkey);
    expect(tree.leafCount).toBe(1);
    expect(tree.totalSupply.toString()).toBe(fixture.amountRaw);
    expect(tree.cancelledAt).toBeNull();
  }, TEST_TIMEOUT);

  it("cliff: claim after cliff fully withdraws entitlement", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(500),
      releaseType: 0,
      startTime: now - 300,
      cliffTime: now - 60,
      endTime: now - 60,
      milestoneIdx: 0,
    });

    const { beneficiaryAta } = await claimSingleStream(connection, fixture);
    const claimRecord = await fetchClaimRecord(connection, beneficiary.publicKey, fixture.treePubkey);

    expect(claimRecord.claimedAmount.toString()).toBe(fixture.amountRaw);
    expect(await tokenBalance(connection, beneficiaryAta)).toBe(Number(fixture.amountRaw));
  }, TEST_TIMEOUT);

  it("cliff: claim before cliff fails with NothingToClaim", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(250),
      releaseType: 0,
      startTime: now - 60,
      cliffTime: now + 3600,
      endTime: now + 3600,
      milestoneIdx: 0,
    });

    try {
      await claimSingleStream(connection, fixture);
    } catch (error) {
      expectErrorCode(error, VESTING_ERROR_CODES.NothingToClaim);
    }
  }, TEST_TIMEOUT);

  it("linear: create with cliff past and end future yields valid state", async () => {
    const now = currentUnix();
    const beneficiary = creator;
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(1000),
      releaseType: 1,
      startTime: now - 3600,
      cliffTime: now - 600,
      endTime: now + 3600,
      milestoneIdx: 0,
    });

    const tree = await fetchTree(connection, fixture.treePubkey);
    expect(tree.leafCount).toBe(1);
    expect(tree.totalSupply.toString()).toBe(fixture.amountRaw);
  }, TEST_TIMEOUT);

  it("linear: partial claim yields 0 < claimed < total", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const amountRaw = uiAmountToRaw(1000);
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw,
      releaseType: 1,
      startTime: now - 3600,
      cliffTime: now - 600,
      endTime: now + 3600,
      milestoneIdx: 0,
    });

    await claimSingleStream(connection, fixture);
    const claimRecord = await fetchClaimRecord(connection, beneficiary.publicKey, fixture.treePubkey);
    const claimed = Number(claimRecord.claimedAmount.toString());

    expect(claimed).toBeGreaterThan(0);
    expect(claimed).toBeLessThan(Number(amountRaw));
  }, TEST_TIMEOUT);

  it("milestone: create with unlock in the past yields valid state", async () => {
    const now = currentUnix();
    const beneficiary = creator;
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(321),
      releaseType: 2,
      startTime: now - 300,
      cliffTime: now - 60,
      endTime: now - 60,
      milestoneIdx: 0,
    });

    const tree = await fetchTree(connection, fixture.treePubkey);
    expect(tree.leafCount).toBe(1);
    expect(tree.totalSupply.toString()).toBe(fixture.amountRaw);
  }, TEST_TIMEOUT);

  it("milestone: claim idx=0 fully claims and sets bitmap", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(777),
      releaseType: 2,
      startTime: now - 300,
      cliffTime: now - 60,
      endTime: now - 60,
      milestoneIdx: 0,
    });

    await setMilestoneReleased(connection, fixture, 0);
    await claimSingleStream(connection, fixture);
    const claimRecord = await fetchClaimRecord(connection, beneficiary.publicKey, fixture.treePubkey);
    expect(claimRecord.claimedAmount.toString()).toBe(fixture.amountRaw);
    expect(claimRecord.milestoneBitmap[0] & 1).toBe(1);
  }, TEST_TIMEOUT);

  it("milestone: double claim fails with MilestoneAlreadyClaimed", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(888),
      releaseType: 2,
      startTime: now - 300,
      cliffTime: now - 60,
      endTime: now - 60,
      milestoneIdx: 0,
    });

    await setMilestoneReleased(connection, fixture, 0);
    await claimSingleStream(connection, fixture);

    try {
      await claimSingleStream(connection, fixture);
      throw new Error("Expected milestone double claim to fail");
    } catch (error) {
      expectErrorCode(error, VESTING_ERROR_CODES.MilestoneAlreadyClaimed);
    }
  }, TEST_TIMEOUT);

  it("milestone: claim before release fails with MilestoneNotReleased", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(111),
      releaseType: 2,
      startTime: now - 60,
      cliffTime: now + 3600,
      endTime: now + 3600,
      milestoneIdx: 0,
    });

    try {
      await claimSingleStream(connection, fixture);
      throw new Error("Expected milestone pre-release claim to fail");
    } catch (error) {
      expectErrorCode(error, VESTING_ERROR_CODES.MilestoneNotReleased);
    }
  }, TEST_TIMEOUT);

  it("cancel: cancel stream sets cancelled_at", async () => {
    const now = currentUnix();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary: creator,
      amountRaw: uiAmountToRaw(444),
      releaseType: 0,
      startTime: now,
      cliffTime: now + 7200,
      endTime: now + 7200,
      milestoneIdx: 0,
    });

    await cancelStream(connection, creator, fixture.treePubkey);
    const tree = await fetchTree(connection, fixture.treePubkey);
    expect(tree.cancelledAt).not.toBeNull();
  }, TEST_TIMEOUT);

  it("cancel: double cancel fails with AlreadyCancelled", async () => {
    const now = currentUnix();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary: creator,
      amountRaw: uiAmountToRaw(555),
      releaseType: 0,
      startTime: now,
      cliffTime: now + 7200,
      endTime: now + 7200,
      milestoneIdx: 0,
    });

    await cancelStream(connection, creator, fixture.treePubkey);
    try {
      await cancelStream(connection, creator, fixture.treePubkey);
      throw new Error("Expected double cancel to fail");
    } catch (error) {
      expectErrorCode(error, VESTING_ERROR_CODES.AlreadyCancelled);
    }
  }, TEST_TIMEOUT);

  it("cancel: non-creator cancel fails with Unauthorized", async () => {
    const now = currentUnix();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary: creator,
      amountRaw: uiAmountToRaw(666),
      releaseType: 0,
      startTime: now,
      cliffTime: now + 7200,
      endTime: now + 7200,
      milestoneIdx: 0,
    });

    const outsiderProgram = makeProgram(connection, fixture.outsider);
    try {
      await outsiderProgram.methods
        .cancelCampaign()
        .accounts({
          cancelAuthority: fixture.outsider.publicKey,
          vestingTree: fixture.treePubkey,
        })
        .rpc();
      throw new Error("Expected unauthorized cancel to fail");
    } catch (error) {
      expectErrorCode(error, VESTING_ERROR_CODES.Unauthorized);
    }
  }, TEST_TIMEOUT);

  it("error: claim while paused fails with CampaignPaused", async () => {
    const now = currentUnix();
    const beneficiary = Keypair.generate();
    const fixture = await createSingleStreamFixture(connection, {
      creator,
      beneficiary,
      amountRaw: uiAmountToRaw(777),
      releaseType: 0,
      startTime: now - 300,
      cliffTime: now - 60,
      endTime: now - 60,
      milestoneIdx: 0,
    });

    await pauseStream(connection, creator, fixture.treePubkey);

    try {
      await claimSingleStream(connection, fixture);
      throw new Error("Expected paused claim to fail");
    } catch (error) {
      expectErrorCode(error, VESTING_ERROR_CODES.CampaignPaused);
    }
  }, TEST_TIMEOUT);
});
