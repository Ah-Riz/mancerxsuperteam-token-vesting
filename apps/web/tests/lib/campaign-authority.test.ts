import { describe, expect, it } from "vitest";
import {
  canCancelCampaign,
  canCancelStream,
  canPauseCampaign,
  canReleaseMilestone,
  canRotateRoot,
  canWithdrawUnvested,
  sameAddress,
} from "@/lib/campaign/authority";

describe("campaign authority helpers", () => {
  const creator = "11111111111111111111111111111111";
  const cancelAuthority = "11111111111111111111111111111112";
  const pauseAuthority = "11111111111111111111111111111113";
  const recipient = "11111111111111111111111111111114";

  it("matches identical addresses", () => {
    expect(sameAddress(creator, creator)).toBe(true);
    expect(sameAddress(creator, cancelAuthority)).toBe(false);
  });

  it("allows cancel only for cancel authority", () => {
    expect(
      canCancelCampaign({
        viewer: cancelAuthority,
        cancelAuthority,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
      }),
    ).toBe(true);

    expect(
      canCancelCampaign({
        viewer: creator,
        cancelAuthority,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
      }),
    ).toBe(false);

    expect(
      canCancelCampaign({
        viewer: recipient,
        cancelAuthority,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
      }),
    ).toBe(false);
  });

  it("allows pause only for pause authority while active", () => {
    expect(
      canPauseCampaign({
        viewer: pauseAuthority,
        pauseAuthority,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
      }),
    ).toBe(true);

    expect(
      canPauseCampaign({
        viewer: creator,
        pauseAuthority,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
      }),
    ).toBe(false);

    expect(
      canPauseCampaign({
        viewer: pauseAuthority,
        pauseAuthority,
        cancelledAt: 1n,
        totalSupply: 100n,
        totalClaimed: 0n,
      }),
    ).toBe(false);

    expect(
      canPauseCampaign({
        viewer: pauseAuthority,
        pauseAuthority,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 100n,
      }),
    ).toBe(false);
  });

  it("allows withdraw unvested only for creator after cancellation", () => {
    expect(
      canWithdrawUnvested({
        viewer: creator,
        creator,
        cancelledAt: 10n,
      }),
    ).toBe(true);

    expect(
      canWithdrawUnvested({
        viewer: cancelAuthority,
        creator,
        cancelledAt: 10n,
      }),
    ).toBe(false);

    expect(
      canWithdrawUnvested({
        viewer: creator,
        creator,
        cancelledAt: null,
      }),
    ).toBe(false);
  });

  it("allows root rotation only for cancel authority on active multi-recipient campaigns", () => {
    expect(
      canRotateRoot({
        viewer: cancelAuthority,
        cancelAuthority,
        cancellable: true,
        cancelledAt: null,
        leafCount: 3,
      }),
    ).toBe(true);

    expect(
      canRotateRoot({
        viewer: creator,
        cancelAuthority,
        cancellable: true,
        cancelledAt: null,
        leafCount: 3,
      }),
    ).toBe(false);

    expect(
      canRotateRoot({
        viewer: cancelAuthority,
        cancelAuthority,
        cancellable: true,
        cancelledAt: null,
        leafCount: 1,
      }),
    ).toBe(false);
  });

  it("allows milestone release only for creator on milestone streams", () => {
    expect(
      canReleaseMilestone({
        viewer: creator,
        creator,
        cancelledAt: null,
        releaseType: 2,
      }),
    ).toBe(true);

    expect(
      canReleaseMilestone({
        viewer: recipient,
        creator,
        cancelledAt: null,
        releaseType: 2,
      }),
    ).toBe(false);

    expect(
      canReleaseMilestone({
        viewer: creator,
        creator,
        cancelledAt: null,
        releaseType: 0,
      }),
    ).toBe(false);

    expect(
      canReleaseMilestone({
        viewer: creator,
        creator,
        cancelledAt: 10n,
        releaseType: 2,
      }),
    ).toBe(false);
  });

  it("allows cancel_stream only for creator on single-leaf cancellable streams", () => {
    expect(
      canCancelStream({
        viewer: creator,
        creator,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
        leafCount: 1,
      }),
    ).toBe(true);

    expect(
      canCancelStream({
        viewer: recipient,
        creator,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
        leafCount: 1,
      }),
    ).toBe(false);

    expect(
      canCancelStream({
        viewer: creator,
        creator,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 0n,
        leafCount: 3,
      }),
    ).toBe(false);

    expect(
      canCancelStream({
        viewer: creator,
        creator,
        cancellable: true,
        cancelledAt: null,
        totalSupply: 100n,
        totalClaimed: 100n,
        leafCount: 1,
      }),
    ).toBe(false);
  });
});
