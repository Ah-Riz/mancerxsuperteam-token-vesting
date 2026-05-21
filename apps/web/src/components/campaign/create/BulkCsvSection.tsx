"use client";

import type { BulkCsvParseResult, PreparedBulkCampaign } from "@/lib/campaign/bulk";
import {
  CARD,
  SECTION,
  INPUT,
  Field,
  SectionHeader,
  SummaryRow,
  ToggleCard,
  formatIssueLabel,
  formatTokenAmount,
} from "./shared";

export function BulkCsvSection({
  mintAddress,
  onMintAddressChange,
  mintDecimals,
  mintLoading,
  campaignId,
  onCampaignIdChange,
  cancellable,
  onCancellableChange,
  csvText,
  onCsvTextChange,
  onParse,
  csvTemplate,
  csvResult,
  prepared,
}: {
  mintAddress: string;
  onMintAddressChange: (value: string) => void;
  mintDecimals: number | null;
  mintLoading: boolean;
  campaignId: string;
  onCampaignIdChange: (value: string) => void;
  cancellable: boolean;
  onCancellableChange: (value: boolean) => void;
  csvText: string;
  onCsvTextChange: (value: string) => void;
  onParse: () => void;
  csvTemplate: string;
  csvResult: BulkCsvParseResult | null;
  prepared: PreparedBulkCampaign | null;
}) {
  const previewRows = csvResult?.rows.slice(0, 5) ?? [];

  return (
    <div className="space-y-5">
      <div className={`${CARD} space-y-4 p-5`}>
        <SectionHeader title="Campaign Configuration" caption="Shared settings for all recipients in this campaign" />
        <Field
          label="Mint Address"
          input={
            <input
              type="text"
              placeholder="Token mint public key"
              value={mintAddress}
              onChange={(e) => onMintAddressChange(e.target.value)}
              className={`${INPUT} font-mono`}
            />
          }
          hint={
            mintLoading
              ? "Fetching mint info..."
              : mintDecimals !== null
                ? `Mint detected — ${mintDecimals} decimals`
                : undefined
          }
          hintClassName={mintDecimals !== null ? "!text-emerald-400" : undefined}
        />
        <Field
          label="Campaign ID"
          input={
            <input
              type="number"
              min="1"
              value={campaignId}
              onChange={(e) => onCampaignIdChange(e.target.value)}
              className={INPUT}
            />
          }
        />
        <ToggleCard
          checked={cancellable}
          onChange={onCancellableChange}
          title="Cancellable"
          body="Creator can cancel and reclaim unvested tokens."
        />
      </div>

      <div className={`${CARD} space-y-4 p-5`}>
        <SectionHeader title="Recipients CSV" caption="Upload or paste CSV with columns: beneficiary, amount, releaseType, startTime, cliffTime, endTime, milestoneIdx" />
        <textarea
          rows={8}
          placeholder={csvTemplate}
          value={csvText}
          onChange={(e) => onCsvTextChange(e.target.value)}
          className={`${INPUT} min-h-[180px] font-mono text-[11px]`}
        />
        <button
          type="button"
          onClick={onParse}
          className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-white/[0.1]"
        >
          Parse & Validate
        </button>

        {csvResult?.issues.length ? (
          <div className="space-y-1">
            {csvResult.issues.map((issue, index) => (
              <p key={`${issue.rowNumber}-${index}`} className="text-[12px] text-red-400">
                {formatIssueLabel(issue.rowNumber)}: {issue.message}
              </p>
            ))}
          </div>
        ) : null}

        {previewRows.length ? (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-white/[0.03] text-[#8b92a5]">
                <tr>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-white/[0.06] text-white">
                    <td className="px-3 py-2 font-mono">{row.beneficiary}</td>
                    <td className="px-3 py-2">{row.amountInput}</td>
                    <td className="px-3 py-2">{row.releaseType === 0 ? "Cliff" : "Linear"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {prepared ? (
          <div className={`${SECTION} space-y-3`}>
            <SummaryRow label="Recipients" value={String(prepared.leafCount)} />
            <SummaryRow
              label="Total Supply"
              value={mintDecimals !== null ? formatTokenAmount(prepared.totalSupply, mintDecimals) : prepared.totalSupply}
            />
            <SummaryRow label="Cliff streams" value={String(prepared.releaseMix.cliff)} />
            <SummaryRow label="Linear streams" value={String(prepared.releaseMix.linear)} />
            <SummaryRow label="Merkle Root" value={`${prepared.merkleRoot.slice(0, 16)}...`} mono />
          </div>
        ) : null}
      </div>
    </div>
  );
}
