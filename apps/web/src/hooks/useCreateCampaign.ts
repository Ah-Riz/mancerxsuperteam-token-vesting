"use client";

import { useCallback } from "react";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  buildCreateCampaignIndexPayload,
  type PreparedBulkCampaign,
} from "@/lib/campaign/bulk";
import { derivePda } from "@/lib/anchor/client";
import { formatVestingError } from "@/lib/anchor/errors";
import { indexCampaign } from "@/lib/stream/persist";
import { useVestingProgram } from "./useVestingProgram";

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
}

export interface FundCampaignResult {
  sig: string;
  treeAddress: string;
}

export function useCreateCampaign() {
  const program = useVestingProgram();
  const { publicKey } = useWallet();

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
            ? `Campaign created on-chain, but indexing failed: ${error.message}`
            : "Campaign created on-chain, but indexing failed.";
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

      const sig = await program.methods
        .fundCampaign(new BN(params.totalSupply))
        .accounts({
          creator: publicKey,
          vestingTree,
          vault,
          sourceAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return {
        sig,
        treeAddress: params.treeAddress,
      };
    },
    [program, publicKey],
  );

  return { createCampaign, fundCampaign, formatVestingError };
}
