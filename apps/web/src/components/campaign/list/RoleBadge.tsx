"use client";

export function RoleBadge({
  role,
}: {
  role: "sender" | "recipient" | "both";
}) {
  const label = role === "both" ? "Sender + Recipient" : role === "recipient" ? "Recipient" : "Sender";

  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#8b92a5]">
      {label}
    </span>
  );
}
