"use client";

import Link from "next/link";
import type { StreamStatus } from "@/lib/vesting/list";
import { RoleBadge } from "./RoleBadge";
import { StatusBadge } from "./StatusBadge";

type Props = {
  treeAddress: string;
  role: "sender" | "recipient" | "both";
  status: StreamStatus;
  typeLabel: string;
  title: string;
  amountLabel: string;
  amountDisplay: string;
  claimableDisplay?: string | null;
  counterpartyLabel: string;
  counterpartyValue: string;
  mintValue: string;
  nextLabel: string;
  nextValue: string;
  createdAtLabel: string;
};

export function CampaignRow({
  treeAddress,
  role,
  status,
  typeLabel,
  title,
  amountLabel,
  amountDisplay,
  claimableDisplay,
  counterpartyLabel,
  counterpartyValue,
  mintValue,
  nextLabel,
  nextValue,
  createdAtLabel,
}: Props) {
  const hasClaimable = claimableDisplay !== null && claimableDisplay !== undefined;

  return (
    <Link
      href={`/campaign/${treeAddress}`}
      className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:bg-white/[0.03]"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={role} />
            <StatusBadge status={status} />
            <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#8b92a5]">
              {typeLabel}
            </span>
          </div>

          <div>
            <p className="text-[16px] font-semibold text-white">{title}</p>
            <p className="mt-1 font-mono text-[12px] text-[#8b92a5]">{treeAddress}</p>
          </div>

          <div className={`grid gap-4 sm:grid-cols-2 ${hasClaimable ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
            <InfoBlock label={amountLabel} value={amountDisplay} />
            {hasClaimable ? <InfoBlock label="Claimable Now" value={claimableDisplay} /> : null}
            <InfoBlock label={counterpartyLabel} value={counterpartyValue} />
            <InfoBlock label="Mint" value={mintValue} mono />
            <InfoBlock label={nextLabel} value={nextValue} />
          </div>
        </div>

        <div className="text-left lg:text-right">
          <p className="text-[12px] text-[#8b92a5]">Created</p>
          <p className="mt-1 text-[13px] text-white">{createdAtLabel}</p>
        </div>
      </div>
    </Link>
  );
}

function InfoBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#6f7c95]">{label}</p>
      <p className={`mt-1 text-[13px] text-white ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
