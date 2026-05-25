"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { datetimeLocalToUnix } from "@/lib/stream/datetime";
import { validatePublicKey, validateAmountWithDecimals, validateSchedule, hasErrors } from "@/lib/validation/stream-form";
import { bulkCsvTemplateForType, parseBulkCsv, prepareBulkCampaign, type BulkCsvParseResult, type PreparedBulkCampaign } from "@/lib/campaign/bulk";
import { useCreateCampaign } from "@/hooks/useCreateCampaign";
import { useCreateStream, type CreateStreamResult } from "@/hooks/useCreateStream";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { useToast } from "@/components/shell/Toast";
import { CARD, INPUT, INPUT_ERR, LABEL, SectionHeader, Field, ToggleCard, TxResultCard, ErrorCard } from "@/components/campaign/create/shared";
import { BulkCsvSection } from "@/components/campaign/create/BulkCsvSection";
import { FormSummary } from "@/components/campaign/create/FormSummary";
import { PageHeader } from "@/components/campaign/create/PageHeader";
import { TokenPickerButton } from "@/components/campaign/create/TokenPickerButton";
import { POPULAR_TOKENS } from "@/lib/constants/popular-tokens";

type Mode = "single" | "bulk";

type StreamEntry = {
  id: string;
  recipient: string;
  amount: string;
  startTime: string;
  cliffTime: string;
  endTime: string;
};

type TxState =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "success"; results: CreateStreamResult[] }
  | { type: "error"; msg: string }
  | { type: "bulk-ready"; prepared: PreparedBulkCampaign }
  | { type: "bulk-created"; sig: string; treeAddress: string; totalSupply: string; prepared: PreparedBulkCampaign }
  | { type: "bulk-funded"; sig: string; treeAddress: string; prepared: PreparedBulkCampaign };

function newStream(): StreamEntry {
  return { id: crypto.randomUUID(), recipient: "", amount: "", startTime: "", cliffTime: "", endTime: "" };
}

export default function LinearCreatePage() {
  const { publicKey } = useWallet();
  const { createStream, formatVestingError: formatStreamError } = useCreateStream();
  const { createCampaign, fundCampaign, formatVestingError: formatCampaignError } = useCreateCampaign();
  const { tokens: walletTokens } = useWalletTokens();
  const { toast } = useToast();

  // General
  const [mode, setMode] = useState<Mode>("single");
  const [mintAddress, setMintAddress] = useState("");
  const [mintDecimals, setMintDecimals] = useState<number | null>(null);
  const [useAutoWrap, setUseAutoWrap] = useState(false);
  const [cancellable, setCancellable] = useState(false);
  const [baseCampaignId] = useState(() => Math.floor(Date.now() / 1000) % 1000000);

  // Stream entries (manual mode)
  const [streams, setStreams] = useState<StreamEntry[]>([newStream()]);
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});
  const [txState, setTxState] = useState<TxState>({ type: "idle" });

  // Bulk state
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<BulkCsvParseResult | null>(null);
  const [bulkCampaignId] = useState(() => String(Math.floor(Date.now() / 1000) % 1000000));

  // Derived
  const tokenInfo = POPULAR_TOKENS.find((t) => t.mint === mintAddress);
  const tokenSymbol = tokenInfo?.isNativeSol && !useAutoWrap ? "wSOL" : (tokenInfo?.symbol ?? (mintAddress ? mintAddress.slice(0, 4) : ""));
  const walletToken = walletTokens.find((t) =>
    t.mintAddress === mintAddress && (useAutoWrap ? t.isNativeSol === true : t.isNativeSol !== true)
  ) ?? walletTokens.find((t) => t.mintAddress === mintAddress);
  const tokenBalance = walletToken?.uiAmount ?? null;
  const totalAmount = streams.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  function handleTokenSelect(mint: string, decimals: number, autoWrap?: boolean) {
    setMintAddress(mint);
    setMintDecimals(decimals);
    setUseAutoWrap(autoWrap ?? false);
  }

  function updateStream(id: string, field: keyof StreamEntry, value: string) {
    setStreams((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  function duplicateStream(index: number) {
    const source = streams[index];
    setStreams((prev) => [...prev.slice(0, index + 1), { ...source, id: crypto.randomUUID(), recipient: "" }, ...prev.slice(index + 1)]);
  }

  function removeStream(index: number) {
    if (streams.length <= 1) return;
    setStreams((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!publicKey || !mintAddress) return;

    const errors: Record<string, string | null> = {};
    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      const recipErr = validatePublicKey(s.recipient);
      if (recipErr) errors[`recipient_${i}`] = recipErr;
      const amtErr = validateAmountWithDecimals(s.amount, mintDecimals);
      if (amtErr) errors[`amount_${i}`] = amtErr;
      if (!s.endTime) errors[`end_${i}`] = "End time is required.";
      const startUnix = s.startTime ? datetimeLocalToUnix(s.startTime) : Math.floor(Date.now() / 1000);
      const cliffUnix = s.cliffTime ? datetimeLocalToUnix(s.cliffTime) : startUnix;
      const endUnix = s.endTime ? datetimeLocalToUnix(s.endTime) : 0;
      const schedErr = s.endTime ? validateSchedule(startUnix, cliffUnix, endUnix, 1) : null;
      if (schedErr) errors[`end_${i}`] = schedErr;
    }
    setFormErrors(errors);
    if (hasErrors(errors)) return;

    setTxState({ type: "loading", label: `Creating ${streams.length} linear stream(s)...` });
    const results: CreateStreamResult[] = [];

    try {
      for (let i = 0; i < streams.length; i++) {
        setTxState({ type: "loading", label: `Creating stream ${i + 1} of ${streams.length}...` });
        const s = streams[i];
        const startUnix = s.startTime ? datetimeLocalToUnix(s.startTime) : Math.floor(Date.now() / 1000);
        const cliffUnix = s.cliffTime ? datetimeLocalToUnix(s.cliffTime) : startUnix;
        const endUnix = datetimeLocalToUnix(s.endTime);
        const cid = String(baseCampaignId * 100 + i);

        const result = await createStream({
          beneficiary: s.recipient, mintAddress, amount: s.amount, mintDecimals,
          campaignId: cid, releaseType: 1, startTime: startUnix, cliffTime: cliffUnix,
          endTime: endUnix, milestoneIdx: 0, cancellable, autoWrap: useAutoWrap,
        });
        results.push(result);
      }
      toast(`${results.length} linear stream(s) created!`, "success");
      setTxState({ type: "success", results });
      setStreams([newStream()]);
      setFormErrors({});
    } catch (error: unknown) {
      if (error instanceof Error && /User rejected|Connection rejected/i.test(error.message)) {
        toast("Transaction rejected by wallet", "error");
        if (results.length > 0) setTxState({ type: "success", results });
        else setTxState({ type: "idle" });
        return;
      }
      if (results.length > 0) {
        toast(`${results.length} of ${streams.length} created. Remaining failed.`, "error");
        setTxState({ type: "success", results });
        return;
      }
      setTxState({ type: "error", msg: formatStreamError(error) });
    }
  }

  // Bulk handlers
  function handleCsvParse() {
    if (!csvText.trim()) return;
    const result = parseBulkCsv(csvText, mintDecimals);
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
      const result = await createCampaign({ mintAddress, campaignId: bulkCampaignId, prepared: txState.prepared, cancellable });
      toast("Campaign created! Now fund the vault.", "success");
      setTxState({ type: "bulk-created", sig: result.sig, treeAddress: result.treeAddress, totalSupply: result.totalSupply, prepared: txState.prepared });
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
    const currentState = txState;
    setTxState({ type: "loading", label: "Funding vault..." });
    try {
      const result = await fundCampaign({ mintAddress, treeAddress: currentState.treeAddress, totalSupply: currentState.totalSupply, autoWrap: useAutoWrap });
      toast("Campaign funded!", "success");
      setTxState({ type: "bulk-funded", sig: result.sig, treeAddress: result.treeAddress, prepared: currentState.prepared });
    } catch (error: unknown) {
      if (error instanceof Error && /User rejected|Connection rejected/i.test(error.message)) {
        toast("Transaction rejected", "error");
        setTxState(currentState);
        return;
      }
      setTxState({ type: "error", msg: formatCampaignError(error) });
    }
  }

  const prepared = txState.type === "bulk-ready" || txState.type === "bulk-created" || txState.type === "bulk-funded" ? txState.prepared : null;

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Linear Vesting" description="Tokens unlock gradually over time, from start to end date." />
        <div className={`${CARD} p-5`}>
          <p className="text-[13px] text-[#8b92a5]">Connect your wallet to create a linear vesting stream.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader title="Linear Vesting" description="Tokens unlock gradually over time, from start to end date." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* General Details Card */}
          <div className={`${CARD} space-y-4 p-5`}>
            <SectionHeader title="General Details" caption="Token and campaign settings" />

            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode("single"); setTxState({ type: "idle" }); }}
                className={`flex-1 rounded-lg px-3 py-2.5 text-[12px] font-medium transition ${mode === "single" ? "bg-white/[0.1] text-white" : "text-[#8b92a5] hover:text-white"}`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => { setMode("bulk"); setTxState({ type: "idle" }); }}
                className={`flex-1 rounded-lg px-3 py-2.5 text-[12px] font-medium transition ${mode === "bulk" ? "bg-white/[0.1] text-white" : "text-[#8b92a5] hover:text-white"}`}
              >
                Use CSV
              </button>
            </div>

            {/* Token */}
            <div>
              <label className={LABEL}>Token</label>
              <TokenPickerButton mintAddress={mintAddress} onSelect={handleTokenSelect} autoWrap={useAutoWrap} error={undefined} />
            </div>

            {/* Cancellation */}
            <ToggleCard checked={cancellable} onChange={setCancellable} title="Allow cancellation?" body="Creator can cancel and reclaim unvested tokens after a 7-day grace period." />
          </div>

          {/* Manual Mode: Stream Cards */}
          {mode === "single" && mintAddress && (
            <>
              {streams.map((stream, i) => (
                <div key={stream.id} className={`${CARD} space-y-4 p-5`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-white">Stream #{i + 1}</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => duplicateStream(i)} className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-[#8b92a5] hover:text-white">
                        Duplicate
                      </button>
                      {streams.length > 1 && (
                        <button type="button" onClick={() => removeStream(i)} className="rounded-md border border-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:text-red-300">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <Field
                    label={`Amount${mintDecimals !== null ? ` (${mintDecimals} decimals)` : ""}`}
                    input={
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. 1000"
                          value={stream.amount}
                          onChange={(e) => updateStream(stream.id, "amount", e.target.value)}
                          className={`${INPUT} pr-24 ${formErrors[`amount_${i}`] ? INPUT_ERR : ""}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          <span className="text-[10px] text-[#555d73]">{tokenSymbol}</span>
                          <button
                            type="button"
                            onClick={() => { if (walletToken) updateStream(stream.id, "amount", walletToken.uiAmount); }}
                            className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#8b92a5] hover:text-white"
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    }
                    error={formErrors[`amount_${i}`]}
                  />

                  {/* Recipient */}
                  <Field
                    label="Recipient"
                    input={
                      <input
                        type="text"
                        placeholder="Solana wallet address..."
                        value={stream.recipient}
                        onChange={(e) => updateStream(stream.id, "recipient", e.target.value)}
                        className={`${INPUT} font-mono ${formErrors[`recipient_${i}`] ? INPUT_ERR : ""}`}
                      />
                    }
                    error={formErrors[`recipient_${i}`]}
                  />

                  {/* Start Time */}
                  <Field
                    label="Start Time (optional)"
                    input={
                      <input
                        type="datetime-local"
                        value={stream.startTime}
                        onChange={(e) => updateStream(stream.id, "startTime", e.target.value)}
                        className={INPUT}
                      />
                    }
                    hint="Defaults to now if empty"
                  />

                  {/* Cliff Time */}
                  <Field
                    label="Cliff Time (optional)"
                    input={
                      <input
                        type="datetime-local"
                        value={stream.cliffTime}
                        onChange={(e) => updateStream(stream.id, "cliffTime", e.target.value)}
                        className={INPUT}
                      />
                    }
                    hint="No tokens vest before this date. Defaults to start time if empty."
                  />

                  {/* End Time */}
                  <Field
                    label="End Time (Full Unlock)"
                    input={
                      <div className="flex gap-2">
                        <input
                          type="datetime-local"
                          value={stream.endTime}
                          onChange={(e) => updateStream(stream.id, "endTime", e.target.value)}
                          className={`${INPUT} flex-1 ${formErrors[`end_${i}`] ? INPUT_ERR : ""}`}
                        />
                        {streams.length > 1 && stream.endTime && (
                          <button
                            type="button"
                            onClick={() => setStreams((prev) => prev.map((s) => ({ ...s, startTime: stream.startTime || s.startTime, cliffTime: stream.cliffTime || s.cliffTime, endTime: stream.endTime })))}
                            className="shrink-0 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-[#8b92a5] hover:text-white"
                            title="Apply schedule to all streams"
                          >
                            Apply all
                          </button>
                        )}
                      </div>
                    }
                    error={formErrors[`end_${i}`]}
                  />
                </div>
              ))}

              {/* Add Stream Button */}
              <button
                type="button"
                onClick={() => setStreams((prev) => [...prev, newStream()])}
                className="w-full rounded-xl border border-dashed border-white/[0.12] py-3 text-[13px] font-medium text-[#8b92a5] transition hover:border-white/[0.2] hover:text-white"
              >
                + Add Stream
              </button>
            </>
          )}

          {/* CSV Mode */}
          {mode === "bulk" && mintAddress && (
            <BulkCsvSection
              mintAddress={mintAddress}
              onMintAddressChange={(v) => setMintAddress(v)}
              mintDecimals={mintDecimals}
              mintLoading={false}
              campaignId={bulkCampaignId}
              onCampaignIdChange={() => {}}
              cancellable={cancellable}
              onCancellableChange={setCancellable}
              csvText={csvText}
              onCsvTextChange={(v) => { setCsvText(v); setCsvResult(null); setTxState({ type: "idle" }); }}
              onParse={handleCsvParse}
              csvTemplate={bulkCsvTemplateForType("linear")}
              csvResult={csvResult}
              prepared={prepared}
              vestingType="linear"
            />
          )}

          {/* Results */}
          {txState.type === "success" && (
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-emerald-400">{txState.results.length} linear stream(s) created!</p>
              {txState.results.map((r, i) => (
                <TxResultCard key={r.sig} title={`Stream #${i + 1}`} sig={r.sig} href={r.shareUrl} linkLabel="Open stream" />
              ))}
            </div>
          )}
          {txState.type === "bulk-created" && <TxResultCard title="Campaign created!" sig={txState.sig} href={`/campaign/${txState.treeAddress}`} linkLabel="View campaign" />}
          {txState.type === "bulk-funded" && <TxResultCard title="Campaign funded!" sig={txState.sig} href={`/campaign/${txState.treeAddress}`} linkLabel="View campaign" />}
          {txState.type === "error" && <ErrorCard title="Transaction Failed" body={txState.msg} />}
        </div>

        {/* Sidebar */}
        <FormSummary
          amount={mode === "single" ? String(totalAmount || "") : (prepared && mintDecimals !== null ? String(Number(prepared.totalSupply) / 10 ** mintDecimals) : (prepared?.totalSupply ?? "0"))}
          tokenSymbol={tokenSymbol}
          tokenBalance={tokenBalance}
          streamCount={1}
          mode={mode === "single" ? "single" : "bulk"}
          submitLabel={
            mode === "bulk"
              ? (txState.type === "bulk-created" ? "Step 2: Fund Vault" : "Step 1: Create Campaign")
              : `Create ${streams.length} Linear Stream${streams.length > 1 ? "s" : ""}`
          }
          loading={txState.type === "loading"}
          disabled={
            mode === "single"
              ? !mintAddress || streams.some((s) => !s.amount || !s.recipient || !s.endTime)
              : txState.type !== "bulk-ready" && txState.type !== "bulk-created"
          }
          onSubmit={
            mode === "single"
              ? handleSubmit
              : txState.type === "bulk-created" ? handleBulkFund : handleBulkCreate
          }
        />
      </div>
    </div>
  );
}
