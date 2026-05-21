"use client";

import { CARD, SummaryRow } from "./shared";

type SummaryItem = {
  label: string;
  value: string;
  mono?: boolean;
};

export function FormSummary({
  title,
  caption,
  rows,
  notice,
}: {
  title: string;
  caption: string;
  rows: SummaryItem[];
  notice?: string;
}) {
  return (
    <aside className={`${CARD} h-fit space-y-4 p-5`}>
      <div>
        <h2 className="text-[16px] font-semibold text-white">{title}</h2>
        <p className="mt-1 text-[13px] text-[#8b92a5]">{caption}</p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <SummaryRow key={`${row.label}-${row.value}`} label={row.label} value={row.value} mono={row.mono} />
        ))}
      </div>
      {notice ? (
        <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] leading-5 text-[#8b92a5]">
          {notice}
        </p>
      ) : null}
    </aside>
  );
}
