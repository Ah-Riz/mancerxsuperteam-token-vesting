"use client";

import {
  CARD,
  INPUT,
  INPUT_ERR,
  Field,
  SectionHeader,
  ToggleCard,
} from "./shared";

type FormErrors = Record<string, string | null>;

export function CommonFields({
  mintAddress,
  onMintAddressChange,
  amount,
  onAmountChange,
  beneficiary,
  onBeneficiaryChange,
  campaignId,
  onCampaignIdChange,
  cancellable,
  onCancellableChange,
  mintDecimals,
  mintLoading,
  formErrors,
  tokenCaption,
}: {
  mintAddress: string;
  onMintAddressChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  beneficiary: string;
  onBeneficiaryChange: (value: string) => void;
  campaignId: string;
  onCampaignIdChange: (value: string) => void;
  cancellable: boolean;
  onCancellableChange: (value: boolean) => void;
  mintDecimals: number | null;
  mintLoading: boolean;
  formErrors: FormErrors;
  tokenCaption: string;
}) {
  return (
    <div className="space-y-5">
      <div className={`${CARD} space-y-4 p-5`}>
        <SectionHeader title="Token Details" caption={tokenCaption} />
        <Field
          label="Mint Address"
          input={
            <input
              type="text"
              placeholder="Token mint public key"
              value={mintAddress}
              onChange={(e) => onMintAddressChange(e.target.value)}
              className={`${INPUT} font-mono ${formErrors.mintAddress ? INPUT_ERR : ""}`}
            />
          }
          error={formErrors.mintAddress}
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
          label={`Amount${mintDecimals !== null ? ` (${mintDecimals} decimals)` : ""}`}
          input={
            <input
              type="text"
              placeholder={mintDecimals !== null ? "e.g. 1000" : "e.g. 1000000000 (raw)"}
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className={`${INPUT} ${formErrors.amount ? INPUT_ERR : ""}`}
            />
          }
          error={formErrors.amount}
        />
      </div>

      <div className={`${CARD} space-y-4 p-5`}>
        <SectionHeader title="Recipient" caption="Wallet that will receive the vested tokens" />
        <Field
          label="Beneficiary Wallet"
          input={
            <input
              type="text"
              placeholder="Recipient wallet address"
              value={beneficiary}
              onChange={(e) => onBeneficiaryChange(e.target.value)}
              className={`${INPUT} font-mono ${formErrors.beneficiary ? INPUT_ERR : ""}`}
            />
          }
          error={formErrors.beneficiary}
        />
      </div>

      <div className="space-y-3">
        <Field
          label="Campaign ID"
          input={
            <input
              type="number"
              min="1"
              value={campaignId}
              onChange={(e) => onCampaignIdChange(e.target.value)}
              className={`${INPUT} ${formErrors.campaignId ? INPUT_ERR : ""}`}
            />
          }
          error={formErrors.campaignId}
          hint="Unique identifier for this vesting campaign"
        />
        <ToggleCard
          checked={cancellable}
          onChange={onCancellableChange}
          title="Cancellable"
          body="Creator can cancel and reclaim unvested tokens after a 7-day grace period."
        />
      </div>
    </div>
  );
}
