"use client";

import { useEffect, useRef, useState } from "react";
import { POPULAR_TOKENS } from "@/lib/constants/popular-tokens";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";

function shortenAddress(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}

export function TokenPickerModal({
  open,
  onClose,
  onSelect,
  selectedMint,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (mint: string, decimals: number) => void;
  selectedMint: string;
}) {
  const [search, setSearch] = useState("");
  const { tokens: walletTokens, loading: walletLoading } = useWalletTokens();
  const { metadata: customToken, loading: customLoading, error: customError } = useTokenMetadata(search);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isSearchingCustom = search.trim().length >= 32;
  const filteredPopular = search.trim()
    ? POPULAR_TOKENS.filter(
        (t) =>
          t.symbol.toLowerCase().includes(search.toLowerCase()) ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.mint.includes(search),
      )
    : POPULAR_TOKENS;

  const filteredWallet = search.trim()
    ? walletTokens.filter((t) => t.mintAddress.includes(search))
    : walletTokens;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1117] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-[16px] font-semibold text-white">Select Token</h3>
          <button onClick={onClose} className="text-[#8b92a5] transition hover:text-white" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/[0.06] px-5 py-3">
          <input
            type="text"
            placeholder="Search token or paste address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-[#11161f] px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-[#6f7c95] focus:border-white/20"
            autoFocus
          />
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
          {/* Popular Tokens */}
          {filteredPopular.length > 0 && !isSearchingCustom && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6f7c95]">Popular Tokens</p>
              <div className="space-y-1">
                {filteredPopular.map((token) => (
                  <button
                    key={token.mint}
                    type="button"
                    onClick={() => { onSelect(token.mint, token.decimals); onClose(); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      selectedMint === token.mint ? "border border-emerald-400/40 bg-emerald-500/10" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    {token.logoURI && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={token.logoURI} alt={token.symbol} className="h-7 w-7 rounded-full" />
                    )}
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-white">{token.symbol}</p>
                      <p className="text-[11px] text-[#8b92a5]">{token.name}</p>
                    </div>
                    <p className="font-mono text-[11px] text-[#6f7c95]">{token.decimals} dec</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Wallet Tokens */}
          {!isSearchingCustom && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6f7c95]">Your Wallet Tokens</p>
              {walletLoading ? (
                <p className="text-[12px] text-[#8b92a5]">Loading...</p>
              ) : filteredWallet.length === 0 ? (
                <p className="text-[12px] text-[#8b92a5]">No tokens found in wallet.</p>
              ) : (
                <div className="space-y-1">
                  {filteredWallet.map((token) => (
                    <button
                      key={token.mintAddress}
                      type="button"
                      onClick={() => { onSelect(token.mintAddress, token.decimals ?? 0); onClose(); }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        selectedMint === token.mintAddress ? "border border-emerald-400/40 bg-emerald-500/10" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-[#8b92a5]">
                        {token.mintAddress.slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="font-mono text-[12px] text-white">{shortenAddress(token.mintAddress)}</p>
                        <p className="text-[11px] text-[#8b92a5]">Balance: {token.uiAmount}</p>
                      </div>
                      <p className="font-mono text-[11px] text-[#6f7c95]">{token.decimals ?? "?"} dec</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Address Search Result */}
          {isSearchingCustom && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6f7c95]">Custom Token</p>
              {customLoading && <p className="text-[12px] text-[#8b92a5]">Fetching token info...</p>}
              {customError && <p className="text-[12px] text-red-400">{customError}</p>}
              {customToken && (
                <button
                  type="button"
                  onClick={() => { onSelect(customToken.mint, customToken.decimals); onClose(); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-left transition hover:bg-emerald-500/10"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">✓</div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-white">{customToken.symbol}</p>
                    <p className="text-[11px] text-[#8b92a5]">{customToken.name} — {customToken.decimals} decimals</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
