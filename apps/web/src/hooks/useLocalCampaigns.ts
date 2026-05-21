"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { derivePda } from "@/lib/anchor/client";
import { listLocalStreamSchedules } from "@/lib/stream/persist";
import { useVestingProgram } from "./useVestingProgram";

type LocalSenderCampaign = {
  treeAddress: string;
  creator: string;
  mint: string;
  campaignId: number;
  leafCount: number;
  totalSupply: string;
  totalClaimed: string;
  cancellable: boolean;
  paused: boolean;
  cancelledAt: number | null;
  createdAt: number;
  metadata: null;
};

type LocalRecipientCampaign = {
  treeAddress: string;
  creator: string;
  mint: string;
  campaignId: number;
  totalSupply: string;
  leafCount: number;
  paused: boolean;
  cancelledAt: number | null;
  createdAt: number;
  metadata: null;
  myClaimed: string;
  myLeaf: {
    leafIndex: number;
    amount: string;
    releaseType: number;
    startTime: number;
    cliffTime: number;
    endTime: number;
    milestoneIdx: number;
  };
};

type LocalCampaignsState = {
  senderCampaigns: LocalSenderCampaign[];
  recipientCampaigns: LocalRecipientCampaign[];
  isLoading: boolean;
  error: string | null;
};

type ClaimRecordAccount = {
  claimedAmount?: { toString(): string };
};

export function useLocalCampaigns(address: string | undefined): LocalCampaignsState {
  const program = useVestingProgram();
  const [state, setState] = useState<LocalCampaignsState>({
    senderCampaigns: [],
    recipientCampaigns: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!program || !address) {
      setState({
        senderCampaigns: [],
        recipientCampaigns: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    const currentAddress = address;
    const activeProgram = program;
    const localStreams = listLocalStreamSchedules();
    if (localStreams.length === 0) {
      setState({
        senderCampaigns: [],
        recipientCampaigns: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const addressKey = new PublicKey(currentAddress);

        const results = await Promise.all(
          localStreams.map(async ({ treeAddress, schedule }) => {
            try {
              const treePubkey = new PublicKey(treeAddress);
              const account = await (activeProgram.account as any).vestingTree.fetch(treePubkey);

              const creator = account.creator.toBase58();
              const mint = account.mint.toBase58();
              const campaignId = Number(account.campaignId.toString());
              const totalSupply = account.totalSupply.toString();
              const totalClaimed = account.totalClaimed.toString();
              const cancelledAt = account.cancelledAt
                ? Number(account.cancelledAt.toString())
                : null;
              const createdAt = Number(account.createdAt.toString());
              const leafCount = Number(account.leafCount);

              const senderCampaign =
                creator === currentAddress
                  ? {
                      treeAddress,
                      creator,
                      mint,
                      campaignId,
                      leafCount,
                      totalSupply,
                      totalClaimed,
                      cancellable: Boolean(account.cancellable),
                      paused: Boolean(account.paused),
                      cancelledAt,
                      createdAt,
                      metadata: null,
                    }
                  : null;

              const isRecipient = schedule.beneficiary === currentAddress;
              let myClaimed = "0";

              if (isRecipient) {
                try {
                  const [claimRecordPda] = derivePda([
                    "claim",
                    treePubkey.toBuffer(),
                    addressKey.toBuffer(),
                  ]);
                  const claimRecord = (await (activeProgram.account as any).claimRecord.fetch(
                    claimRecordPda,
                  )) as ClaimRecordAccount;
                  myClaimed = claimRecord.claimedAmount?.toString() ?? "0";
                } catch {
                  myClaimed = "0";
                }
              }

              const recipientCampaign =
                isRecipient
                  ? {
                      treeAddress,
                      creator,
                      mint,
                      campaignId,
                      totalSupply,
                      leafCount,
                      paused: Boolean(account.paused),
                      cancelledAt,
                      createdAt,
                      metadata: null,
                      myClaimed,
                      myLeaf: {
                        leafIndex: 0,
                        amount: totalSupply,
                        releaseType: schedule.releaseType,
                        startTime: schedule.startTime,
                        cliffTime: schedule.cliffTime,
                        endTime: schedule.endTime,
                        milestoneIdx: schedule.milestoneIdx,
                      },
                    }
                  : null;

              return { senderCampaign, recipientCampaign };
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        setState({
          senderCampaigns: results
            .flatMap((result) => (result?.senderCampaign ? [result.senderCampaign] : [])),
          recipientCampaigns: results
            .flatMap((result) => (result?.recipientCampaign ? [result.recipientCampaign] : [])),
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          senderCampaigns: [],
          recipientCampaigns: [],
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load local streams",
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [address, program]);

  return state;
}
