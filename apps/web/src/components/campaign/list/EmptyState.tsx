"use client";

import Link from "next/link";

type Props = {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, body, actionHref, actionLabel }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-8 py-16 text-center">
      <h2 className="text-[16px] font-semibold text-white">{title}</h2>
      <p className="mt-2 text-[13px] text-[#8b92a5]">{body}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-[13px] font-medium text-[#0d1117] transition hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
