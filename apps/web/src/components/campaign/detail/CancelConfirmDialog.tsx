"use client";

import { useState } from "react";

type Props = {
  isOpen: boolean;
  onConfirm: () => void;
  onConfirmStream?: () => void;
  onClose: () => void;
  isLoading: boolean;
  isStreamLoading?: boolean;
  isSingleStream?: boolean;
  scheduleLoaded?: boolean;
  beneficiaryUnknown?: boolean;
  manualBeneficiary?: string;
  onManualBeneficiaryChange?: (value: string) => void;
  totalSupply: bigint;
  totalClaimed: bigint;
  vestedAmount: bigint;
};

export function CancelConfirmDialog({
  isOpen,
  onConfirm,
  onConfirmStream,
  onClose,
  isLoading,
  isStreamLoading,
  isSingleStream,
  scheduleLoaded = true,
  beneficiaryUnknown,
  manualBeneficiary,
  onManualBeneficiaryChange,
  totalSupply,
  totalClaimed,
  vestedAmount,
}: Props) {
  const [mode, setMode] = useState<"instant" | "grace">("instant");

  if (!isOpen) return null;

  const unclaimedVested = vestedAmount > totalClaimed ? vestedAmount - totalClaimed : 0n;
  const returnedToCreator = totalSupply > vestedAmount ? totalSupply - vestedAmount : 0n;
  const showToggle = isSingleStream && onConfirmStream;
  const instantDisabled = !scheduleLoaded;
  const effectiveMode = instantDisabled ? "grace" : mode;
  const activeLoading = showToggle && effectiveMode === "instant" ? isStreamLoading : isLoading;
  const beneficiaryValid = !beneficiaryUnknown || (manualBeneficiary && manualBeneficiary.length >= 32);
  const confirmDisabled = !!activeLoading || (showToggle && effectiveMode === "instant" && !beneficiaryValid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md space-y-5 rounded-2xl border border-white/[0.08] bg-[#0d1017] p-6">
        <h3 className="text-[15px] font-semibold text-red-400">
          Cancel this vesting stream?
        </h3>

        {showToggle && (
          <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={() => setMode("instant")}
              disabled={instantDisabled}
              className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                effectiveMode === "instant"
                  ? "bg-white/[0.08] text-white"
                  : "text-[#8b92a5] hover:text-white"
              } ${instantDisabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              Instant Settle
            </button>
            <button
              type="button"
              onClick={() => setMode("grace")}
              className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                effectiveMode === "grace"
                  ? "bg-white/[0.08] text-white"
                  : "text-[#8b92a5] hover:text-white"
              }`}
            >
              Grace Period
            </button>
          </div>
        )}

        {showToggle && instantDisabled && (
          <p className="text-[11px] text-amber-400">
            Instant Settle unavailable — schedule parameters not loaded. Load from URL or enter manually first.
          </p>
        )}

        {(!showToggle || effectiveMode === "grace") && (
          <>
            <p className="text-[13px] text-[#8b92a5]">
              This action is irreversible. Vesting will freeze at the current moment.
              Recipients can still claim tokens vested up to now.
            </p>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#8b92a5]">Already claimed</span>
                <span className="font-medium text-white">{totalClaimed.toString()} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b92a5]">Unclaimed vested (claimable by recipient)</span>
                <span className="font-medium text-emerald-400">~{unclaimedVested.toString()} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b92a5]">Unvested (recoverable after 7-day grace)</span>
                <span className="font-medium text-amber-400">~{returnedToCreator.toString()} tokens</span>
              </div>
            </div>

            <p className="text-[11px] text-[#555d73]">
              Unvested tokens are NOT returned immediately. Use &quot;Withdraw Unvested&quot; after the 7-day grace period.
            </p>
          </>
        )}

        {showToggle && effectiveMode === "instant" && (
          <>
            <p className="text-[13px] text-[#8b92a5]">
              Settle immediately in one transaction. Vested tokens go to the beneficiary,
              remaining tokens return to you. No grace period.
            </p>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#8b92a5]">To beneficiary (vested)</span>
                <span className="font-medium text-emerald-400">~{(unclaimedVested + totalClaimed).toString()} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b92a5]">Returned to you (unvested)</span>
                <span className="font-medium text-amber-400">~{returnedToCreator.toString()} tokens</span>
              </div>
            </div>

            {beneficiaryUnknown && onManualBeneficiaryChange && (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-400">
                  Beneficiary not found in indexed data. Enter the wallet address:
                </p>
                <input
                  type="text"
                  value={manualBeneficiary ?? ""}
                  onChange={(e) => onManualBeneficiaryChange(e.target.value)}
                  placeholder="Beneficiary wallet address"
                  className="w-full rounded-lg border border-white/[0.08] bg-[#11161f] px-3 py-2 font-mono text-[12px] text-white outline-none placeholder:text-[#555d73] focus:border-white/20"
                />
              </div>
            )}

            <p className="text-[11px] text-[#555d73]">
              This is irreversible. Tokens are distributed atomically in a single transaction.
            </p>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={!!activeLoading}
            className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-[13px] text-[#8b92a5] transition hover:bg-white/[0.04] disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={showToggle && effectiveMode === "instant" ? onConfirmStream : onConfirm}
            disabled={confirmDisabled}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-[13px] font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {activeLoading
              ? "Cancelling..."
              : showToggle && effectiveMode === "instant"
                ? "Cancel & Settle"
                : "Cancel Stream"}
          </button>
        </div>
      </div>
    </div>
  );
}
