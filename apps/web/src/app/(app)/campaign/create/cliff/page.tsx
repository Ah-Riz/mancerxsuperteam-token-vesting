"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { datetimeLocalToUnix } from "@/lib/stream/datetime";
import {
  validateCreateStreamForm,
  hasErrors,
  type FormErrors,
} from "@/lib/validation/stream-form";
import { bulkCsvTemplate, parseBulkCsv, prepareBulkCampaign, type BulkCsvParseResult, type PreparedBulkCampaign } from "@/lib/campaign/bulk";
import { useCreateCampaign } from "@/hooks/useCreateCampaign";
import { useCreateStream, type CreateStreamResult } from "@/hooks/useCreateStream";
import { useMintInfo } from "@/hooks/useMintInfo";
import { useToast } from "@/components/shell/Toast";
import { ErrorCard, TxResultCard } from "@/components/campaign/create/shared";
import { BulkCsvSection } from "@/components/campaign/create/BulkCsvSection";
import { CommonFields } from "@/components/campaign/create/CommonFields";
import { CreationModeTabs } from "@/components/campaign/create/CreationModeTabs";
import { FormSummary } from "@/components/campaign/create/FormSummary";
import { PageHeader } from "@/components/campaign/create/PageHeader";
import { ScheduleCliff } from "@/components/campaign/create/ScheduleCliff";
import { SubmitSection } from "@/components/campaign/create/SubmitSection";

type Mode = "single" | "bulk";
type TxState =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "success"; result: CreateStreamResult }
  | { type: "error"; msg: string }
  | { type: "bulk-ready"; prepared: PreparedBulkCampaign }
  | { type: "bulk-created"; sig: string; treeAddress: string; totalSupply: string; prepared: PreparedBulkCampaign }
  | { type: "bulk-funded"; sig: string; treeAddress: string; prepared: PreparedBulkCampaign };

export default function CliffCreatePage() {
  const { publicKey } = useWallet();
  const { createStream, formatVestingError: formatStreamError } = useCreateStream();
  const { createCampaign, fundCampaign, formatVestingError: formatCampaignError } = useCreateCampaign();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("single");

  const [beneficiary, setBeneficiary] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [amount, setAmount] = useState("");
  const { mintDecimals, mintLoading } = useMintInfo(mintAddress);
  const [campaignId, setCampaignId] = useState(() => String(Math.floor(Date.now() / 1000) % 1000000));
  const [startTime, setStartTime] = useState("");
  const [cliffTime, setCliffTime] = useState("");
  const [cancellable, setCancellable] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [txState, setTxState] = useState<TxState>({ type: "idle" });

  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<BulkCsvParseResult | null>(null);
  const [bulkMint, setBulkMint] = useState("");
  const { mintDecimals: bulkDecimals, mintLoading: bulkMintLoading } = useMintInfo(bulkMint);
  const [bulkCampaignId, setBulkCampaignId] = useState(() => String(Math.floor(Date.now() / 1000) % 1000000));
  const [bulkCancellable, setBulkCancellable] = useState(false);

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;

    const startUnix = startTime ? datetimeLocalToUnix(startTime) : Number.NaN;
    const cliffUnix = cliffTime ? datetimeLocalToUnix(cliffTime) : Number.NaN;

    const errors = validateCreateStreamForm({
      beneficiary,
      mintAddress,
      amount,
      mintDecimals,
      campaignId,
      startUnix,
      cliffUnix,
      endUnix: cliffUnix,
      releaseType: 0,
      milestoneIdx: "0",
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
        releaseType: 0,
        startTime: startUnix,
        cliffTime: cliffUnix,
        endTime: cliffUnix,
        milestoneIdx: 0,
        cancellable,
      });
      toast("Cliff stream created!", "success");
      if (result.indexWarning) toast(result.indexWarning, "info");
      setTxState({ type: "success", result });
    } catch (error: unknown) {
      if (error instanceof Error && /User rejected|Connection rejected/i.test(error.message)) {
        toast("Transaction rejected by wallet", "error");
        setTxState({ type: "idle" });
        return;
      }
      setTxState({ type: "error", msg: formatStreamError(error) });
    }
  }

  function handleCsvParse() {
    if (!csvText.trim()) return;
    const result = parseBulkCsv(csvText, bulkDecimals);
    setCsvResult(result);
    if (result.issues.length === 0 && result.rows.length > 0) {
      setTxState({ type: "bulk-ready", prepared: prepareBulkCampaign(result.rows) });
    } else {
      setTxState({ type: "idle" });
    }
  }

  async function handleBulkCreate() {
    if (txState.type !== "bulk-ready") return;

    setTxState({ type: "loading", label: "Creating campaign..." });
    try {
      const result = await createCampaign({
        mintAddress: bulkMint,
        campaignId: bulkCampaignId,
        prepared: txState.prepared,
        cancellable: bulkCancellable,
      });
      toast("Campaign created! Now fund the vault.", "success");
      if (result.indexWarning) toast(result.indexWarning, "info");
      setTxState({
        type: "bulk-created",
        sig: result.sig,
        treeAddress: result.treeAddress,
        totalSupply: result.totalSupply,
        prepared: txState.prepared,
      });
    } catch (error: unknown) {
      if (error instanceof Error && /User rejected|Connection rejected/i.test(error.message)) {
        toast("Transaction rejected", "error");
        setTxState({ type: "bulk-ready", prepared: txState.prepared });
        return;
      }
      setTxState({ type: "error", msg: formatCampaignError(error) });
    }
  }

  async function handleBulkFund() {
    if (txState.type !== "bulk-created") return;

    setTxState({ type: "loading", label: "Funding vault..." });
    try {
      const result = await fundCampaign({
        mintAddress: bulkMint,
        treeAddress: txState.treeAddress,
        totalSupply: txState.totalSupply,
      });
      toast("Campaign funded!", "success");
      setTxState({
        type: "bulk-funded",
        sig: result.sig,
        treeAddress: result.treeAddress,
        prepared: txState.prepared,
      });
    } catch (error: unknown) {
      if (error instanceof Error && /User rejected|Connection rejected/i.test(error.message)) {
        toast("Transaction rejected", "error");
        setTxState(txState);
        return;
      }
      setTxState({ type: "error", msg: formatCampaignError(error) });
    }
  }

  const prepared =
    txState.type === "bulk-ready" || txState.type === "bulk-created" || txState.type === "bulk-funded"
      ? txState.prepared
      : null;

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Cliff Vesting"
          description="All tokens unlock at a single date. Nothing before, everything after."
        />
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
          <p className="text-[13px] text-[#8b92a5]">Connect your wallet to create a cliff vesting stream.</p>
        </div>
      </div>
    );
  }

  const singleSummaryRows = [
    { label: "Type", value: "Cliff" },
    { label: "Mode", value: "Single" },
    { label: "Recipient", value: beneficiary || "—", mono: !!beneficiary },
    { label: "Amount", value: amount || "—" },
    { label: "Unlock", value: cliffTime || "—" },
  ];

  const bulkSummaryRows = [
    { label: "Type", value: "Cliff Campaign" },
    { label: "Mode", value: "Bulk" },
    { label: "Campaign ID", value: bulkCampaignId || "—" },
    { label: "Recipients", value: prepared ? String(prepared.leafCount) : "—" },
    { label: "Total Supply", value: prepared ? prepared.totalSupply : "—" },
  ];

  const bulkButtonLabel =
    txState.type === "bulk-created" ? "Step 2: Fund Vault" : "Step 1: Create Campaign";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Cliff Vesting"
        description="All tokens unlock at a single date. Nothing before, everything after."
      />

      <CreationModeTabs
        mode={mode}
        onChange={(nextMode) => {
          setMode(nextMode);
          setTxState({ type: "idle" });
        }}
        tone="amber"
      />

      {mode === "single" ? (
        <form onSubmit={handleSingleSubmit} className="space-y-6">
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
                tokenCaption="Token mint and amount for this cliff stream"
              />
              <ScheduleCliff
                startTime={startTime}
                onStartTimeChange={setStartTime}
                cliffTime={cliffTime}
                onCliffTimeChange={setCliffTime}
                scheduleError={formErrors.schedule}
              />
            </div>

            <FormSummary
              title="Form Summary"
              caption="Review the unlock profile before sending the transaction."
              rows={singleSummaryRows}
              notice="Cliff streams unlock the entire amount exactly at the cliff timestamp."
            />
          </div>

          <SubmitSection
            tone="amber"
            idleLabel="Create Cliff Stream"
            loadingLabel={txState.type === "loading" ? txState.label : "Creating stream..."}
            loading={txState.type === "loading"}
            disabled={false}
          >
            {txState.type === "success" ? (
              <TxResultCard
                title="Cliff stream created!"
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
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <BulkCsvSection
              mintAddress={bulkMint}
              onMintAddressChange={setBulkMint}
              mintDecimals={bulkDecimals}
              mintLoading={bulkMintLoading}
              campaignId={bulkCampaignId}
              onCampaignIdChange={setBulkCampaignId}
              cancellable={bulkCancellable}
              onCancellableChange={setBulkCancellable}
              csvText={csvText}
              onCsvTextChange={(value) => {
                setCsvText(value);
                setCsvResult(null);
                setTxState({ type: "idle" });
              }}
              onParse={handleCsvParse}
              csvTemplate={bulkCsvTemplate()}
              csvResult={csvResult}
              prepared={prepared}
            />

            <FormSummary
              title="Campaign Summary"
              caption="Bulk cliff campaigns prepare a Merkle tree, then fund the shared vault."
              rows={bulkSummaryRows}
              notice="Bulk flow is two-step: create campaign first, then fund the vault with the full total supply."
            />
          </div>

          <SubmitSection
            tone="amber"
            type="button"
            onClick={txState.type === "bulk-created" ? handleBulkFund : handleBulkCreate}
            idleLabel={bulkButtonLabel}
            loadingLabel={txState.type === "loading" ? txState.label : "Processing..."}
            loading={txState.type === "loading"}
            disabled={txState.type !== "bulk-ready" && txState.type !== "bulk-created"}
          >
            {txState.type === "bulk-created" ? (
              <TxResultCard
                title="Campaign created!"
                sig={txState.sig}
                href={`/campaign/${txState.treeAddress}`}
                linkLabel="View campaign"
              />
            ) : null}
            {txState.type === "bulk-funded" ? (
              <TxResultCard
                title="Campaign funded!"
                sig={txState.sig}
                href={`/campaign/${txState.treeAddress}`}
                linkLabel="View campaign"
              />
            ) : null}
            {txState.type === "error" ? (
              <ErrorCard title="Transaction Failed" body={txState.msg} />
            ) : null}
          </SubmitSection>
        </div>
      )}
    </div>
  );
}
