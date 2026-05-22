"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { type Program } from "@coral-xyz/anchor";
import { isMilestoneTriggered } from "@/lib/vesting/milestone";
import { formatVestingError } from "@/lib/anchor/errors";

type Props = {
  program: Program;
  publicKey: PublicKey;
  treePubkey: PublicKey;
  milestoneReleasedFlags: Uint8Array;
  leafCount: number;
  canRelease: boolean;
  onSuccess: () => void;
  toast: (msg: string, type?: "success" | "error" | "info") => void;
};

export function MilestoneReleasePanel({
  program,
  publicKey,
  treePubkey,
  milestoneReleasedFlags,
  leafCount,
  canRelease,
  onSuccess,
  toast,
}: Props) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  if (!canRelease || leafCount <= 1) return null;

  const count = Math.min(leafCount, 32);

  async function handleRelease(idx: number) {
    setLoadingIdx(idx);
    try {
      await program.methods
        .setMilestoneReleased(idx)
        .accounts({ creator: publicKey, vestingTree: treePubkey })
        .rpc();
      toast(`Milestone #${idx} released.`, "success");
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error && /User rejected|Connection rejected/i.test(err.message)) return;
      toast(formatVestingError(err), "error");
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="mb-3 text-[12px] font-medium text-[#8b92a5]">Milestone Releases</p>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => {
          const released = isMilestoneTriggered(milestoneReleasedFlags, i);
          return (
            <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.04] px-3 py-2">
              <span className="text-[12px] text-white">Milestone #{i}</span>
              {released ? (
                <span className="text-[11px] text-emerald-400">Released ✓</span>
              ) : (
                <button
                  onClick={() => handleRelease(i)}
                  disabled={loadingIdx !== null}
                  className="rounded-md border border-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-400 transition hover:bg-violet-500/5 disabled:opacity-50"
                >
                  {loadingIdx === i ? "..." : "Release"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
