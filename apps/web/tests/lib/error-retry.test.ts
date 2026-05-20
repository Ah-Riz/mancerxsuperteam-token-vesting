import { describe, it, expect } from "vitest";
import { isRetryableError, formatVestingError } from "@/lib/anchor/errors";

describe("isRetryableError", () => {
  it("returns true for BlockhashNotFound", () => {
    expect(isRetryableError(new Error("BlockhashNotFound"))).toBe(true);
  });

  it("returns true for TransactionExpiredBlockheightExceeded", () => {
    expect(isRetryableError(new Error("TransactionExpiredBlockheightExceeded"))).toBe(true);
  });

  it("returns true for network fetch failure", () => {
    expect(isRetryableError(new Error("Failed to fetch"))).toBe(true);
  });

  it("returns true for timeout", () => {
    expect(isRetryableError(new Error("Request timeout"))).toBe(true);
  });

  it("returns false for Unauthorized", () => {
    expect(isRetryableError(new Error("Unauthorized"))).toBe(false);
  });

  it("returns false for InvalidSchedule", () => {
    expect(isRetryableError(new Error("InvalidSchedule"))).toBe(false);
  });

  it("returns false for User rejected", () => {
    expect(isRetryableError(new Error("User rejected the request"))).toBe(false);
  });

  it("returns false for AlreadyCancelled", () => {
    expect(isRetryableError(new Error("AlreadyCancelled"))).toBe(false);
  });
});

describe("formatVestingError — transient errors", () => {
  it("formats BlockhashNotFound", () => {
    expect(formatVestingError(new Error("BlockhashNotFound"))).toBe("Transaction expired. Please try again.");
  });

  it("formats network error", () => {
    expect(formatVestingError(new Error("Failed to fetch"))).toBe("Network error. Check your connection and try again.");
  });
});
