// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";

const mockUseWalletTokens = vi.fn();

vi.mock("@/hooks/useWalletTokens", () => ({
  useWalletTokens: () => mockUseWalletTokens(),
}));

import { TokenPicker } from "@/components/campaign/create/TokenPicker";

const TOKEN_MINT = "Mint111111111111111111111111111111111111111";
const MANUAL_MINT = "Manual1111111111111111111111111111111111111";

function renderTokenPicker(overrides: Partial<ComponentProps<typeof TokenPicker>> = {}) {
  const props: ComponentProps<typeof TokenPicker> = {
    mintAddress: "",
    onMintAddressChange: vi.fn(),
    mintDecimals: null,
    mintLoading: false,
    error: null,
    helperText: "Choose a mint from your wallet or paste one manually.",
    ...overrides,
  };

  const result = render(createElement(TokenPicker, props));
  return { ...result, props };
}

describe("TokenPicker", () => {
  beforeEach(() => {
    cleanup();
    mockUseWalletTokens.mockReset();
    mockUseWalletTokens.mockReturnValue({
      tokens: [
        {
          mintAddress: TOKEN_MINT,
          balanceRaw: "2500000",
          decimals: 6,
          uiAmount: "2.5",
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("fills the mint address when a wallet token is selected", () => {
    const onMintAddressChange = vi.fn();
    renderTokenPicker({ onMintAddressChange });

    fireEvent.click(screen.getByRole("button", { name: `Select token ${TOKEN_MINT}` }));

    expect(onMintAddressChange).toHaveBeenCalledWith(TOKEN_MINT);
  });

  it("switches to manual mode and preserves paste input", () => {
    const onMintAddressChange = vi.fn();
    renderTokenPicker({ onMintAddressChange });

    fireEvent.click(screen.getByText("Use manual mint address"));
    fireEvent.change(screen.getByPlaceholderText("Paste mint public key"), {
      target: { value: MANUAL_MINT },
    });

    expect(onMintAddressChange).toHaveBeenCalledWith(MANUAL_MINT);
  });

  it("shows mint decimals hint for a valid manual mint", async () => {
    renderTokenPicker({
      mintAddress: MANUAL_MINT,
      mintDecimals: 9,
      mintLoading: false,
    });

    await waitFor(() => {
      expect(screen.getByText("Mint detected — 9 decimals")).toBeTruthy();
    });
  });
});
