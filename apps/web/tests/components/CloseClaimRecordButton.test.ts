// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { CloseClaimRecordButton } from "@/components/campaign/detail/CloseClaimRecordButton";

function renderButton(overrides = {}) {
  const props = {
    program: {} as any,
    publicKey: {} as any,
    treePubkey: {} as any,
    totalEntitled: 1000n,
    claimedAmount: 1000n,
    cancelledAt: null as bigint | null,
    nowTs: 1000000n,
    onSuccess: () => {},
    toast: () => {},
    ...overrides,
  };
  return render(createElement(CloseClaimRecordButton, props));
}

describe("CloseClaimRecordButton", () => {
  afterEach(() => cleanup());

  it("renders nothing when not fully claimed and not post-grace", () => {
    const { container } = renderButton({ claimedAmount: 500n, cancelledAt: null });
    expect(container.innerHTML).toBe("");
  });

  it("shows button when fully claimed", () => {
    renderButton({ totalEntitled: 1000n, claimedAmount: 1000n });
    expect(screen.getByText(/Close Record/)).toBeTruthy();
  });

  it("shows button when post-grace after cancel", () => {
    renderButton({
      totalEntitled: 1000n,
      claimedAmount: 500n,
      cancelledAt: 100000n,
      nowTs: 100000n + 604800n + 1n,
    });
    expect(screen.getByText(/Close Record/)).toBeTruthy();
  });

  it("renders nothing when within grace period", () => {
    const { container } = renderButton({
      totalEntitled: 1000n,
      claimedAmount: 500n,
      cancelledAt: 100000n,
      nowTs: 100000n + 100n,
    });
    expect(container.innerHTML).toBe("");
  });
});
