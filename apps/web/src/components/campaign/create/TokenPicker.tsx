"use client";

import { useEffect, useState } from "react";
import { INPUT, INPUT_ERR, LABEL } from "./shared";
import { useWalletTokens } from "@/hooks/useWalletTokens";

function shortenMintAddress(mintAddress: string) {
  if (mintAddress.length <= 12) return mintAddress;
  return `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`;
}

function formatBalanceLabel(uiAmount: string) {
  const [whole, fraction] = uiAmount.split(".");
  const wholeValue = Number(whole);
  const wholeLabel = Number.isFinite(wholeValue) ? wholeValue.toLocaleString() : whole;

  if (!fraction) return wholeLabel;
  return `${wholeLabel}.${fraction.slice(0, 4).replace(/0+$/, "") || "0"}`;
}

export function TokenPicker({
  mintAddress,
  onMintAddressChange,
  mintDecimals,
  mintLoading,
  error,
  helperText,
}: {
  mintAddress: string;
  onMintAddressChange: (value: string) => void;
  mintDecimals: number | null;
  mintLoading: boolean;
  error?: string | null;
  helperText?: string;
}) {
  const { tokens, loading, error: walletError, refetch } = useWalletTokens();
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (mintAddress && !tokens.some((token) => token.mintAddress === mintAddress)) {
      setManualMode(true);
    }
  }, [mintAddress, tokens]);

  const selectedWalletToken = manualMode ? null : tokens.find((token) => token.mintAddress === mintAddress) ?? null;

  const hint = error
    ? null
    : mintLoading
      ? "Fetching mint info..."
      : mintDecimals !== null
        ? `Mint detected — ${mintDecimals} decimals`
        : helperText;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className={LABEL}>Token Source</label>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] font-medium text-[#8b92a5] transition hover:border-white/15 hover:text-white"
        >
          Refresh tokens
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-white">Wallet Tokens</p>
            <p className="mt-1 text-[12px] text-[#8b92a5]">
              Select a mint from your wallet, or switch to manual paste.
            </p>
          </div>
          {!manualMode ? (
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] font-medium text-white transition hover:border-white/20"
            >
              Use manual mint address
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] font-medium text-white transition hover:border-white/20"
            >
              Back to wallet tokens
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-[12px] text-[#8b92a5]">Loading wallet tokens...</p>
        ) : walletError ? (
          <p className="text-[12px] text-amber-300">
            Could not load wallet tokens. Manual mint paste is still available.
          </p>
        ) : tokens.length === 0 ? (
          <p className="text-[12px] text-[#8b92a5]">
            No SPL token accounts were detected for this wallet. Paste a mint address manually to continue.
          </p>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {tokens.map((token) => {
              const isSelected = selectedWalletToken?.mintAddress === token.mintAddress;

              return (
                <button
                  key={token.mintAddress}
                  type="button"
                  aria-label={`Select token ${token.mintAddress}`}
                  onClick={() => {
                    setManualMode(false);
                    onMintAddressChange(token.mintAddress);
                  }}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/[0.06] bg-[#11161f] hover:border-white/[0.14]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[12px] text-white">{shortenMintAddress(token.mintAddress)}</p>
                      <p className="mt-1 text-[11px] text-[#8b92a5]">{token.mintAddress}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-medium text-white">{formatBalanceLabel(token.uiAmount)}</p>
                      <p className="mt-1 text-[11px] text-[#8b92a5]">
                        {token.decimals !== null ? `${token.decimals} decimals` : "Decimals unavailable"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {manualMode ? (
        <div>
          <label className={LABEL}>Manual Mint Address</label>
          <input
            type="text"
            placeholder="Paste mint public key"
            value={mintAddress}
            onChange={(event) => onMintAddressChange(event.target.value)}
            className={`${INPUT} font-mono ${error ? INPUT_ERR : ""}`}
          />
        </div>
      ) : null}

      {selectedWalletToken && !manualMode ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-[12px] font-medium text-emerald-300">Selected mint</p>
          <p className="mt-1 break-all font-mono text-[12px] text-white">{selectedWalletToken.mintAddress}</p>
        </div>
      ) : null}

      {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
      {!error && hint ? <p className="text-[12px] text-[#8b92a5]">{hint}</p> : null}
    </div>
  );
}
