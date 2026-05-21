"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";

export function useMintInfo(mintAddress: string) {
  const { connection } = useConnection();
  const [mintDecimals, setMintDecimals] = useState<number | null>(null);
  const [mintLoading, setMintLoading] = useState(false);

  const fetchMintInfo = useCallback(
    async (addr: string) => {
      try {
        const pubkey = new PublicKey(addr);
        setMintLoading(true);
        const info = await connection.getParsedAccountInfo(pubkey);
        const parsed = (info.value?.data as any)?.parsed;
        if (parsed?.type === "mint") {
          setMintDecimals(parsed.info.decimals);
          return;
        }
        setMintDecimals(null);
      } catch {
        setMintDecimals(null);
      } finally {
        setMintLoading(false);
      }
    },
    [connection],
  );

  useEffect(() => {
    if (mintAddress.length >= 32 && mintAddress.length <= 44) {
      try {
        new PublicKey(mintAddress);
        void fetchMintInfo(mintAddress);
      } catch {
        setMintDecimals(null);
      }
    } else {
      setMintDecimals(null);
    }
  }, [mintAddress, fetchMintInfo]);

  return { mintDecimals, mintLoading };
}
