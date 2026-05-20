import { describe, it, expect } from "vitest";
import { formatVestingError, VESTING_ERROR_CODES } from "@/lib/anchor/errors";
import { GRACE_PERIOD_SECS } from "@/lib/vesting/display";

describe("cancel error mapping", () => {
  it("maps NotCancellable code to user message", () => {
    const err = new Error(`custom program error: 0x${VESTING_ERROR_CODES.NotCancellable.toString(16)}`);
    expect(formatVestingError(err)).toBe("This stream was created as non-cancellable.");
  });

  it("maps AlreadyCancelled code to user message", () => {
    const err = new Error(`custom program error: 0x${VESTING_ERROR_CODES.AlreadyCancelled.toString(16)}`);
    expect(formatVestingError(err)).toBe("Stream is already cancelled.");
  });

  it("maps Unauthorized code to user message", () => {
    const err = new Error(`custom program error: 0x${VESTING_ERROR_CODES.Unauthorized.toString(16)}`);
    expect(formatVestingError(err)).toBe("You are not authorized for this action.");
  });

  it("maps GracePeriodActive code to user message", () => {
    const err = new Error(`custom program error: 0x${VESTING_ERROR_CODES.GracePeriodActive.toString(16)}`);
    expect(formatVestingError(err)).toBe("Grace period is still active; unvested sweep not allowed yet.");
  });

  it("maps NotCancelled code to user message", () => {
    const err = new Error(`custom program error: 0x${VESTING_ERROR_CODES.NotCancelled.toString(16)}`);
    expect(formatVestingError(err)).toBe("Stream must be cancelled first.");
  });
});

describe("grace period calculation", () => {
  it("grace end = cancelledAt + 7 days", () => {
    const cancelledAt = 1700000000n;
    const graceEnd = cancelledAt + GRACE_PERIOD_SECS;
    expect(graceEnd).toBe(1700604800n);
  });

  it("GRACE_PERIOD_SECS equals 604800", () => {
    expect(GRACE_PERIOD_SECS).toBe(BigInt(7 * 24 * 60 * 60));
  });
});
