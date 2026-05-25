"use client";

import { useState } from "react";
import { POPULAR_TOKENS } from "@/lib/constants/popular-tokens";
import { TokenPickerModal } from "./TokenPickerModal";

function shortenAddress(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}

const NATIVE_MINT_ADDRESS = "So11111111111111111111111111111111111111112";

export function TokenPickerButton({
  mintAddress,
  onSelect,
  autoWrap,
  error,
}: {
  mintAddress: string;
  onSelect: (mint: string, decimals: number, autoWrap?: boolean) => void;
  autoWrap?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const selected = POPULAR_TOKENS.find((t) => t.mint === mintAddress);

  // Determine display label for NATIVE_MINT cases
  const isNativeMint = mintAddress === NATIVE_MINT_ADDRESS;
  const displayLabel = isNativeMint
    ? (autoWrap ? "SOL (Auto-wrap)" : "wSOL")
    : selected?.symbol ?? undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
          error ? "border-red-500/40" : "border-white/[0.08] hover:border-white/20"
        } bg-[#11161f]`}
      >
        {selected || (isNativeMint && displayLabel) ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {selected?.logoURI && !(isNativeMint && !autoWrap) ? (
              <img src={selected.logoURI} alt={displayLabel ?? selected.symbol} className="h-6 w-6 rounded-full" />
            ) : isNativeMint && !autoWrap ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2d3a] text-[9px] font-bold text-white/60">W</div>
            ) : null}
            <span className="flex-1 text-[13px] font-medium text-white">{displayLabel ?? selected?.symbol}</span>
          </>
        ) : mintAddress ? (
          <>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-[#8b92a5]">
              {mintAddress.slice(0, 2)}
            </div>
            <span className="flex-1 font-mono text-[12px] text-white">{shortenAddress(mintAddress)}</span>
          </>
        ) : (
          <span className="flex-1 text-[13px] text-[#6f7c95]">Select Token</span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6f7c95]">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {error && <p className="mt-1 text-[12px] text-red-400">{error}</p>}
      <TokenPickerModal open={open} onClose={() => setOpen(false)} onSelect={onSelect} selectedMint={mintAddress} />
    </>
  );
}
