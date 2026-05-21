"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { POPULAR_TOKENS } from "@/lib/constants/popular-tokens";

export type TokenMetadata = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
};

export function useTokenMetadata(query: string) {
  const { connection } = useConnection();
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMetadata = useCallback(
    async (address: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Check popular tokens first
      const popular = POPULAR_TOKENS.find((t) => t.mint === address);
      if (popular) {
        setMetadata(popular);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setMetadata(null);

      try {
        const pubkey = new PublicKey(address);
        const info = await connection.getAccountInfo(pubkey);
        if (controller.signal.aborted) return;

        if (!info || info.data.length < 82) {
          setError("Not a valid SPL token mint");
          setLoading(false);
          return;
        }

        if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
          setError("Not a valid SPL token mint");
          setLoading(false);
          return;
        }

        const decimals = info.data[44];

        setMetadata({
          mint: address,
          symbol: address.slice(0, 4).toUpperCase(),
          name: `Token ${address.slice(0, 6)}...`,
          decimals,
        });
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setError("Invalid address or fetch failed");
          setLoading(false);
        }
      }
    },
    [connection],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 32) {
      setMetadata(null);
      setError(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => void fetchMetadata(trimmed), 300);
    return () => clearTimeout(timer);
  }, [query, fetchMetadata]);

  return { metadata, loading, error };
}
