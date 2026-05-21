"use client";

import type { StreamStatus } from "@/lib/vesting/list";

export function StatusBadge({ status }: { status: StreamStatus }) {
  const classes =
    status === "Claimable"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "Claimed"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
        : status === "Paused"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
          : status === "Cancelled"
            ? "border-red-500/20 bg-red-500/10 text-red-400"
            : "border-white/[0.08] bg-white/[0.03] text-[#8b92a5]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${classes}`}>
      {status}
    </span>
  );
}
