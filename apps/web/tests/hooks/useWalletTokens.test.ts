// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { mockUseConnection, mockUseWallet } = vi.hoisted(() => ({
  mockUseConnection: vi.fn(),
  mockUseWallet: vi.fn(),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: mockUseConnection,
  useWallet: mockUseWallet,
}));

import { useWalletTokens } from "@/hooks/useWalletTokens";

const WALLET_PUBLIC_KEY = {
  toBase58: () => "Wallet1111111111111111111111111111111111111",
};

const MINT_ALPHA = "Alpha1111111111111111111111111111111111111";
const MINT_BETA = "Beta11111111111111111111111111111111111111";
const MINT_ZERO = "Zero11111111111111111111111111111111111111";

function parsedTokenAccount(mint: string, amount: string, decimals = 6) {
  return {
    account: {
      data: {
        parsed: {
          info: {
            mint,
            tokenAmount: {
              amount,
              decimals,
            },
          },
        },
      },
    },
  };
}

describe("useWalletTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes, deduplicates, and sorts wallet tokens by balance", async () => {
    const getParsedTokenAccountsByOwner = vi.fn().mockResolvedValue({
      value: [
        parsedTokenAccount(MINT_ALPHA, "2500000"),
        parsedTokenAccount(MINT_BETA, "5000000"),
        parsedTokenAccount(MINT_ALPHA, "500000"),
        parsedTokenAccount(MINT_ZERO, "0"),
      ],
    });

    mockUseConnection.mockReturnValue({
      connection: { getParsedTokenAccountsByOwner },
    });
    mockUseWallet.mockReturnValue({ publicKey: WALLET_PUBLIC_KEY });

    const { result } = renderHook(() => useWalletTokens());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getParsedTokenAccountsByOwner).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.tokens).toEqual([
      {
        mintAddress: MINT_BETA,
        balanceRaw: "5000000",
        decimals: 6,
        uiAmount: "5",
      },
      {
        mintAddress: MINT_ALPHA,
        balanceRaw: "3000000",
        decimals: 6,
        uiAmount: "3",
      },
      {
        mintAddress: MINT_ZERO,
        balanceRaw: "0",
        decimals: 6,
        uiAmount: "0",
      },
    ]);
  });

  it("returns an empty list when the wallet has no SPL token accounts", async () => {
    mockUseConnection.mockReturnValue({
      connection: {
        getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
      },
    });
    mockUseWallet.mockReturnValue({ publicKey: WALLET_PUBLIC_KEY });

    const { result } = renderHook(() => useWalletTokens());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tokens).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces fetch errors without blocking the manual flow", async () => {
    mockUseConnection.mockReturnValue({
      connection: {
        getParsedTokenAccountsByOwner: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
      },
    });
    mockUseWallet.mockReturnValue({ publicKey: WALLET_PUBLIC_KEY });

    const { result } = renderHook(() => useWalletTokens());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tokens).toEqual([]);
    expect(result.current.error).toContain("RPC unavailable");
  });
});
