"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { RootRotationCard } from "@/components/campaign/detail/RootRotationCard";
import { useCampaignDetail } from "@/hooks/useCampaignDetail";
import { useVestingProgram } from "@/hooks/useVestingProgram";
import { useToast } from "@/components/shell/Toast";
import { canRotateRoot } from "@/lib/campaign/authority";

type OnChainTreeState = {
  merkleRoot: number[];
  leafCount: number;
  cancellable: boolean;
  cancelAuthority: PublicKey | null;
  cancelledAt: BN | null;
};

function truncateHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function CampaignAllocationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeAddress } = use(params);
  const { publicKey } = useWallet();
  const program = useVestingProgram();
  const { toast } = useToast();
  const campaignDetailQuery = useCampaignDetail(treeAddress);
  const [treeState, setTreeState] = useState<OnChainTreeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setError(null);
    try {
      const treePubkey = new PublicKey(treeAddress);
      const account = await (program.account as any).vestingTree.fetch(treePubkey);
      setTreeState({
        merkleRoot: account.merkleRoot,
        leafCount: account.leafCount,
        cancellable: account.cancellable,
        cancelAuthority: account.cancelAuthority ?? null,
        cancelledAt: account.cancelledAt ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaign state.");
    } finally {
      setLoading(false);
    }
  }, [program, treeAddress]);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  const canRotate = canRotateRoot({
    viewer: publicKey,
    cancelAuthority: treeState?.cancelAuthority,
    cancellable: treeState?.cancellable ?? false,
    cancelledAt: treeState?.cancelledAt ? BigInt(treeState.cancelledAt.toString()) : null,
    leafCount: treeState?.leafCount ?? campaignDetailQuery.data?.leafCount ?? 0,
  });

  const currentMerkleRoot =
    treeState ? Buffer.from(treeState.merkleRoot).toString("hex") : campaignDetailQuery.data?.merkleRoot ?? "";
  const currentLeafCount = treeState?.leafCount ?? campaignDetailQuery.data?.leafCount ?? 0;
  const rootVersions = campaignDetailQuery.data?.rootVersions ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Link
              href={`/campaign/${treeAddress}`}
              className="inline-flex items-center gap-2 text-[12px] font-medium text-[#8b92a5] transition hover:text-white"
            >
              <span aria-hidden="true">←</span>
              Back to campaign
            </Link>
            <h1 className="text-[24px] font-semibold text-white">Allocation Editor</h1>
            <p className="max-w-3xl text-[14px] leading-7 text-[#8b92a5]">
              Update recipients or amounts for future claims.
            </p>
          </div>
          {currentMerkleRoot && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6f7c95]">Active Root</p>
              <p className="mt-2 font-mono text-[12px] text-white">{truncateHash(currentMerkleRoot)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6f7c95]">When To Use</p>
          <p className="mt-3 text-[13px] leading-6 text-[#8b92a5]">
            Fix a wallet, amount, or recipient list.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6f7c95]">What It Does</p>
          <p className="mt-3 text-[13px] leading-6 text-[#8b92a5]">
            Replaces the active Merkle root. Old proofs stop working.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6f7c95]">Authority Check</p>
          <p className="mt-3 text-[13px] leading-6 text-[#8b92a5]">
            Only the cancel authority can publish this update.
          </p>
        </div>
      </div>

      {!publicKey && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-[13px] text-[#8b92a5]">
          Connect your wallet to access the allocation editor.
        </div>
      )}

      {publicKey && loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-[13px] text-[#8b92a5]">
          Loading allocation editor…
        </div>
      )}

      {publicKey && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {publicKey && !loading && !error && currentMerkleRoot && (
        <>
          {!canRotate && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-[13px] leading-6 text-amber-200">
              This wallet can view the allocation state, but cannot publish updates.
            </div>
          )}
          <RootRotationCard
            treeAddress={treeAddress}
            canRotate={canRotate}
            currentMerkleRoot={currentMerkleRoot}
            currentLeafCount={currentLeafCount}
            rootVersions={rootVersions}
            onSuccess={() => {
              void fetchTree();
              void campaignDetailQuery.refetch();
            }}
            toast={toast}
          />
        </>
      )}
    </div>
  );
}
