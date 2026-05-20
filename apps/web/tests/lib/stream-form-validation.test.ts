import { describe, it, expect } from "vitest";
import {
  validatePublicKey,
  validateAmount,
  validateCampaignId,
  validateSchedule,
  validateMilestoneIdx,
  validateCreateStreamForm,
  hasErrors,
} from "@/lib/validation/stream-form";

describe("validatePublicKey", () => {
  it("returns null for valid base58 pubkey", () => {
    expect(validatePublicKey("11111111111111111111111111111111")).toBeNull();
  });

  it("returns error for empty string", () => {
    expect(validatePublicKey("")).toBe("Required.");
  });

  it("returns error for invalid base58", () => {
    expect(validatePublicKey("not-a-pubkey!@#")).toBe("Invalid Solana address.");
  });

  it("returns error for too short string", () => {
    expect(validatePublicKey("abc")).toBe("Invalid Solana address.");
  });
});

describe("validateAmount", () => {
  it("returns null for valid amount", () => {
    expect(validateAmount("1000000")).toBeNull();
  });

  it("returns error for empty", () => {
    expect(validateAmount("")).toBe("Required.");
  });

  it("returns error for zero", () => {
    expect(validateAmount("0")).toBe("Must be greater than zero.");
  });

  it("returns error for decimal", () => {
    expect(validateAmount("10.5")).toBe("Must be a positive integer (no decimals).");
  });

  it("returns error for negative", () => {
    expect(validateAmount("-100")).toBe("Must be a positive integer (no decimals).");
  });

  it("returns error for non-numeric", () => {
    expect(validateAmount("abc")).toBe("Must be a positive integer (no decimals).");
  });

  it("accepts large numbers", () => {
    expect(validateAmount("999999999999999")).toBeNull();
  });
});

describe("validateCampaignId", () => {
  it("returns null for valid ID", () => {
    expect(validateCampaignId("1")).toBeNull();
  });

  it("returns error for empty", () => {
    expect(validateCampaignId("")).toBe("Required.");
  });

  it("returns error for zero", () => {
    expect(validateCampaignId("0")).toBe("Must be a positive integer.");
  });

  it("returns error for negative", () => {
    expect(validateCampaignId("-1")).toBe("Must be a positive integer.");
  });

  it("returns error for decimal", () => {
    expect(validateCampaignId("1.5")).toBe("Must be a positive integer.");
  });
});

describe("validateSchedule", () => {
  it("returns null for valid order", () => {
    expect(validateSchedule(100, 200, 300, 1)).toBeNull();
  });

  it("returns null when all equal", () => {
    expect(validateSchedule(100, 100, 100, 1)).toBeNull();
  });

  it("returns error when cliff before start", () => {
    expect(validateSchedule(200, 100, 300, 1)).toBe("Cliff time must be on or after start time.");
  });

  it("returns error when end before cliff", () => {
    expect(validateSchedule(100, 200, 150, 1)).toBe("End time must be on or after cliff time.");
  });

  it("returns error for NaN dates", () => {
    expect(validateSchedule(NaN, 200, 300, 1)).toBe("All dates are required.");
  });
});

describe("validateMilestoneIdx", () => {
  it("returns null for 0", () => {
    expect(validateMilestoneIdx("0")).toBeNull();
  });

  it("returns null for 255", () => {
    expect(validateMilestoneIdx("255")).toBeNull();
  });

  it("returns error for 256", () => {
    expect(validateMilestoneIdx("256")).toBe("Must be 0–255.");
  });

  it("returns error for negative", () => {
    expect(validateMilestoneIdx("-1")).toBe("Must be 0–255.");
  });

  it("returns error for empty", () => {
    expect(validateMilestoneIdx("")).toBe("Required.");
  });
});

describe("validateCreateStreamForm", () => {
  const validForm = {
    beneficiary: "11111111111111111111111111111111",
    mintAddress: "11111111111111111111111111111111",
    amount: "1000000",
    campaignId: "1",
    startUnix: 100,
    cliffUnix: 200,
    endUnix: 300,
    releaseType: 1,
    milestoneIdx: "0",
  };

  it("returns no errors for valid form", () => {
    const errors = validateCreateStreamForm(validForm);
    expect(hasErrors(errors)).toBe(false);
  });

  it("returns multiple errors for invalid form", () => {
    const errors = validateCreateStreamForm({
      ...validForm,
      beneficiary: "bad",
      amount: "0",
    });
    expect(errors.beneficiary).toBe("Invalid Solana address.");
    expect(errors.amount).toBe("Must be greater than zero.");
    expect(hasErrors(errors)).toBe(true);
  });

  it("validates milestoneIdx only for milestone type", () => {
    const errors = validateCreateStreamForm({ ...validForm, releaseType: 2, milestoneIdx: "300" });
    expect(errors.milestoneIdx).toBe("Must be 0–255.");
  });

  it("skips milestoneIdx validation for non-milestone types", () => {
    const errors = validateCreateStreamForm({ ...validForm, releaseType: 1, milestoneIdx: "300" });
    expect(errors.milestoneIdx).toBeUndefined();
  });
});

describe("hasErrors", () => {
  it("returns false for all null values", () => {
    expect(hasErrors({ a: null, b: null })).toBe(false);
  });

  it("returns true when any error exists", () => {
    expect(hasErrors({ a: null, b: "Error!" })).toBe(true);
  });

  it("returns false for empty object", () => {
    expect(hasErrors({})).toBe(false);
  });
});
