"use client";

import { useCallback, useEffect, useState } from "react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { normalizeWalletTokens, type WalletTokenOption } from "@/lib/token/normalize";

export function useWalletTokens(): {
  tokens: WalletTokenOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [tokens, setTokens] = useState<WalletTokenOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setTokens([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      setTokens(normalizeWalletTokens(response.value));
    } catch (fetchError) {
      setTokens([]);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load wallet tokens.");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { tokens, loading, error, refetch };
}
