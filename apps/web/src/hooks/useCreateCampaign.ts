"use client";

import { useCallback } from "react";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  buildCreateCampaignIndexPayload,
  type PreparedBulkCampaign,
} from "@/lib/campaign/bulk";
import { derivePda } from "@/lib/anchor/client";
import { formatVestingError } from "@/lib/anchor/errors";
import { indexCampaign, saveStreamScheduleLocal } from "@/lib/stream/persist";
import { useVestingProgram } from "./useVestingProgram";
import { buildWrapSolInstructions } from "@/lib/sol/auto-wrap";

export interface CreateCampaignParams {
  mintAddress: string;
  campaignId: string;
  prepared: PreparedBulkCampaign;
  cancellable: boolean;
}

export interface CreateCampaignResult {
  sig: string;
  treeAddress: string;
  totalSupply: string;
  indexWarning: string | null;
}

export interface FundCampaignParams {
  mintAddress: string;
  treeAddress: string;
  totalSupply: string;
  autoWrap?: boolean;
}

export interface FundCampaignResult {
  sig: string;
  treeAddress: string;
}

export function useCreateCampaign() {
  const program = useVestingProgram();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const createCampaign = useCallback(
    async (params: CreateCampaignParams): Promise<CreateCampaignResult> => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const mintKey = new PublicKey(params.mintAddress);
      const campaignIdBN = new BN(params.campaignId);
      const [vestingTree] = derivePda([
        "tree",
        publicKey.toBuffer(),
        mintKey.toBuffer(),
        campaignIdBN.toArrayLike(Buffer, "le", 8),
      ]);
      const [vaultAuthority] = derivePda(["vault_authority", vestingTree.toBuffer()]);
      const vault = getAssociatedTokenAddressSync(mintKey, vaultAuthority, true);

      const sig = await program.methods
        .createCampaign({
          campaignId: campaignIdBN,
          merkleRoot: Array.from(Buffer.from(params.prepared.merkleRoot, "hex")),
          totalSupply: new BN(params.prepared.totalSupply),
          leafCount: new BN(params.prepared.leafCount),
          cancellable: params.cancellable,
          cancelAuthority: params.cancellable ? publicKey : null,
          pauseAuthority: publicKey,
        })
        .accounts({
          creator: publicKey,
          vestingTree,
          vaultAuthority,
          vault,
          mint: mintKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      let indexWarning: string | null = null;
      const treeAddress = vestingTree.toBase58();

      // Save first leaf's schedule to localStorage for detail page display
      if (params.prepared.leaves.length > 0) {
        const firstLeaf = params.prepared.leaves[0];
        saveStreamScheduleLocal(treeAddress, {
          releaseType: firstLeaf.releaseType,
          startTime: Number(firstLeaf.startTime),
          cliffTime: Number(firstLeaf.cliffTime),
          endTime: Number(firstLeaf.endTime),
          milestoneIdx: firstLeaf.milestoneIdx,
          beneficiary: firstLeaf.beneficiary,
          amount: firstLeaf.amount,
        });
      }

      try {
        await indexCampaign(
          buildCreateCampaignIndexPayload({
            treeAddress,
            creator: publicKey.toBase58(),
            mint: mintKey.toBase58(),
            campaignId: Number(params.campaignId),
            cancellable: params.cancellable,
            cancelAuthority: params.cancellable ? publicKey.toBase58() : null,
            pauseAuthority: publicKey.toBase58(),
            prepared: params.prepared,
          }),
        );
      } catch (error) {
        indexWarning =
          error instanceof Error
            ? `Campaign created on-chain, but DB indexing failed and was queued for retry: ${error.message}`
            : "Campaign created on-chain, but DB indexing failed and was queued for retry.";
      }

      return {
        sig,
        treeAddress,
        totalSupply: params.prepared.totalSupply,
        indexWarning,
      };
    },
    [program, publicKey],
  );

  const fundCampaign = useCallback(
    async (params: FundCampaignParams): Promise<FundCampaignResult> => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const mintKey = new PublicKey(params.mintAddress);
      const vestingTree = new PublicKey(params.treeAddress);
      const sourceAta = getAssociatedTokenAddressSync(mintKey, publicKey);
      const [vaultAuthority] = derivePda(["vault_authority", vestingTree.toBuffer()]);
      const vault = getAssociatedTokenAddressSync(mintKey, vaultAuthority, true);

      let sig: string;

      if (params.autoWrap === true) {
        const lamports = Number(params.totalSupply);
        const wrapIxs = await buildWrapSolInstructions(connection, publicKey, lamports);

        const fundIx = await program.methods
          .fundCampaign(new BN(params.totalSupply))
          .accounts({
            creator: publicKey,
            vestingTree,
            vault,
            sourceAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();

        const tx = new Transaction();
        for (const ix of wrapIxs) tx.add(ix);
        tx.add(fundIx);

        sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
      } else {
        sig = await program.methods
          .fundCampaign(new BN(params.totalSupply))
          .accounts({
            creator: publicKey,
            vestingTree,
            vault,
            sourceAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      }

      return {
        sig,
        treeAddress: params.treeAddress,
      };
    },
    [program, publicKey, connection, sendTransaction],
  );

  return { createCampaign, fundCampaign, formatVestingError };
}
