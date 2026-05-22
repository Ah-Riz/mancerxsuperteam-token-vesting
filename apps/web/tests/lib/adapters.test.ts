import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { toAnchorLeaf } from "../../src/lib/anchor/adapters";

describe("toAnchorLeaf", () => {
  const baseLeaf = {
    leafIndex: 0,
    beneficiary: "11111111111111111111111111111111",
    amount: "1000000",
    releaseType: 1,
    startTime: 1700000000,
    cliffTime: 0,
    endTime: 1731536000,
    milestoneIdx: 0,
  };

  it("converts to camelCase Anchor fields (Anchor auto-maps to snake_case)", () => {
    const result = toAnchorLeaf(baseLeaf);

    expect(result).toHaveProperty("leafIndex", baseLeaf.leafIndex);
    expect(result).toHaveProperty("beneficiary");
    expect(result).toHaveProperty("releaseType", baseLeaf.releaseType);
    expect(result).toHaveProperty("startTime");
    expect(result).toHaveProperty("cliffTime");
    expect(result).toHaveProperty("endTime");
    expect(result).toHaveProperty("milestoneIdx", baseLeaf.milestoneIdx);
  });

  it("converts string amount to BN", () => {
    const result = toAnchorLeaf(baseLeaf);

    expect(result.amount).toBeDefined();
    expect(typeof result.amount.toString).toBe("function");
    expect(result.amount.toString()).toBe("1000000");
  });

  it("converts string timestamps to BN", () => {
    const result = toAnchorLeaf(baseLeaf);

    expect(result.startTime.toString()).toBe("1700000000");
    expect(result.cliffTime.toString()).toBe("0");
    expect(result.endTime.toString()).toBe("1731536000");
  });

  it("handles releaseType 0 (Cliff)", () => {
    const result = toAnchorLeaf({ ...baseLeaf, releaseType: 0 });
    expect(result.releaseType).toBe(0);
  });

  it("handles releaseType 1 (Linear)", () => {
    const result = toAnchorLeaf({ ...baseLeaf, releaseType: 1 });
    expect(result.releaseType).toBe(1);
  });

  it("handles releaseType 2 (Milestone)", () => {
    const result = toAnchorLeaf({ ...baseLeaf, releaseType: 2 });
    expect(result.releaseType).toBe(2);
  });

  it("handles milestoneIdx of 0", () => {
    const result = toAnchorLeaf({ ...baseLeaf, milestoneIdx: 0 });
    expect(result.milestoneIdx).toBe(0);
  });

  it("handles milestoneIdx of 5", () => {
    const result = toAnchorLeaf({ ...baseLeaf, milestoneIdx: 5 });
    expect(result.milestoneIdx).toBe(5);
  });

  it("handles zero amount string", () => {
    const result = toAnchorLeaf({ ...baseLeaf, amount: "0" });
    expect(result.amount.toString()).toBe("0");
  });

  it("converts beneficiary string to PublicKey", () => {
    const pubkey = "G6iaigUdi2btFwUc2N65twfxwA8Ew5uKKhKJ5RJa8wvu";
    const result = toAnchorLeaf({ ...baseLeaf, beneficiary: pubkey });
    expect(result.beneficiary).toBeInstanceOf(PublicKey);
    expect(result.beneficiary.toBase58()).toBe(pubkey);
  });
});
