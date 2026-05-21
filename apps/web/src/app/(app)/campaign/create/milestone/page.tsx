"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { datetimeLocalToUnix } from "@/lib/stream/datetime";
import {
  validateCreateStreamForm,
  hasErrors,
  type FormErrors,
} from "@/lib/validation/stream-form";
import { useCreateStream, type CreateStreamResult } from "@/hooks/useCreateStream";
import { useMintInfo } from "@/hooks/useMintInfo";
import { useToast } from "@/components/shell/Toast";
import { ErrorCard, NoticeCard, TxResultCard } from "@/components/campaign/create/shared";
import { CommonFields } from "@/components/campaign/create/CommonFields";
import { CreationModeTabs } from "@/components/campaign/create/CreationModeTabs";
import { FormSummary } from "@/components/campaign/create/FormSummary";
import { PageHeader } from "@/components/campaign/create/PageHeader";
import { ScheduleMilestone } from "@/components/campaign/create/ScheduleMilestone";
import { SubmitSection } from "@/components/campaign/create/SubmitSection";

type TxState =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "success"; result: CreateStreamResult }
  | { type: "error"; msg: string };

export default function MilestoneCreatePage() {
  const { publicKey } = useWallet();
  const { createStream, formatVestingError } = useCreateStream();
  const { toast } = useToast();

  const [beneficiary, setBeneficiary] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [amount, setAmount] = useState("");
  const { mintDecimals, mintLoading } = useMintInfo(mintAddress);
  const [campaignId, setCampaignId] = useState(() => String(Math.floor(Date.now() / 1000) % 1000000));
  const [startTime, setStartTime] = useState("");
  const [unlockTime, setUnlockTime] = useState("");
  const [milestoneIdx, setMilestoneIdx] = useState("0");
  const [cancellable, setCancellable] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [txState, setTxState] = useState<TxState>({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;

    const startUnix = startTime ? datetimeLocalToUnix(startTime) : Number.NaN;
    const unlockUnix = unlockTime ? datetimeLocalToUnix(unlockTime) : Number.NaN;

    const errors = validateCreateStreamForm({
      beneficiary,
      mintAddress,
      amount,
      mintDecimals,
      campaignId,
      startUnix,
      cliffUnix: unlockUnix,
      endUnix: unlockUnix,
      releaseType: 2,
      milestoneIdx,
    });
    setFormErrors(errors);
    if (hasErrors(errors)) return;

    setTxState({ type: "loading", label: "Creating stream..." });
    try {
      const result = await createStream({
        beneficiary,
        mintAddress,
        amount,
        mintDecimals,
        campaignId,
        releaseType: 2,
        startTime: startUnix,
        cliffTime: unlockUnix,
        endTime: unlockUnix,
        milestoneIdx: Number(milestoneIdx),
        cancellable,
      });
      toast("Milestone stream created!", "success");
      if (result.indexWarning) toast(result.indexWarning, "info");
      setTxState({ type: "success", result });
    } catch (error: unknown) {
      if (error instanceof Error && /User rejected|Connection rejected/i.test(error.message)) {
        toast("Transaction rejected by wallet", "error");
        setTxState({ type: "idle" });
        return;
      }
      setTxState({ type: "error", msg: formatVestingError(error) });
    }
  }

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Milestone Vesting"
          description="Full release after a time-gated milestone. Tracked by on-chain bitmap index."
        />
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
          <p className="text-[13px] text-[#8b92a5]">Connect your wallet to create a milestone vesting stream.</p>
        </div>
      </div>
    );
  }

  const summaryRows = [
    { label: "Type", value: "Milestone" },
    { label: "Mode", value: "Single" },
    { label: "Recipient", value: beneficiary || "—", mono: !!beneficiary },
    { label: "Amount", value: amount || "—" },
    { label: "Milestone Index", value: milestoneIdx || "0" },
    { label: "Unlock", value: unlockTime || "—" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Milestone Vesting"
        description="Full release after a time-gated milestone. Tracked by on-chain bitmap index."
      />

      <CreationModeTabs mode="single" onChange={() => {}} tone="blue" allowBulk={false} />
      <NoticeCard
        title="Single Stream Only"
        body="Milestone vesting is single-stream only. Bulk campaigns are available for Cliff and Linear types."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <CommonFields
              mintAddress={mintAddress}
              onMintAddressChange={setMintAddress}
              amount={amount}
              onAmountChange={setAmount}
              beneficiary={beneficiary}
              onBeneficiaryChange={setBeneficiary}
              campaignId={campaignId}
              onCampaignIdChange={setCampaignId}
              cancellable={cancellable}
              onCancellableChange={setCancellable}
              mintDecimals={mintDecimals}
              mintLoading={mintLoading}
              formErrors={formErrors}
              tokenCaption="Token mint and amount for this milestone stream"
            />
            <ScheduleMilestone
              startTime={startTime}
              onStartTimeChange={setStartTime}
              unlockTime={unlockTime}
              onUnlockTimeChange={setUnlockTime}
              milestoneIdx={milestoneIdx}
              onMilestoneIdxChange={setMilestoneIdx}
              scheduleError={formErrors.schedule}
              milestoneError={formErrors.milestoneIdx}
            />
          </div>

          <FormSummary
            title="Form Summary"
            caption="Review the milestone gate before sending the transaction."
            rows={summaryRows}
            notice="Milestone streams unlock the full amount once the unlock timestamp is reached and the milestone index is still unclaimed."
          />
        </div>

        <SubmitSection
          tone="blue"
          idleLabel="Create Milestone Stream"
          loadingLabel={txState.type === "loading" ? txState.label : "Creating stream..."}
          loading={txState.type === "loading"}
          disabled={false}
        >
          {txState.type === "success" ? (
            <TxResultCard
              title="Milestone stream created!"
              sig={txState.result.sig}
              href={txState.result.shareUrl}
              linkLabel="Open stream"
            />
          ) : null}
          {txState.type === "error" ? (
            <ErrorCard title="Transaction Failed" body={txState.msg} />
          ) : null}
        </SubmitSection>
      </form>
    </div>
  );
}
