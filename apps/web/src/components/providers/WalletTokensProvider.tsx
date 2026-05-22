"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { normalizeWalletTokens, type WalletTokenOption } from "@/lib/token/normalize";

type WalletTokensCtx = {
  tokens: WalletTokenOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const WalletTokensContext = createContext<WalletTokensCtx>({
  tokens: [],
  loading: false,
  error: null,
  refetch: async () => {},
});

export function WalletTokensProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [tokens, setTokens] = useState<WalletTokenOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!publicKey || fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      setTokens(normalizeWalletTokens(response.value));
    } catch (err) {
      setTokens([]);
      setError(err instanceof Error ? err.message : "Failed to load wallet tokens.");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (!publicKey) { setTokens([]); return; }
    void refetch();
  }, [publicKey, refetch]);

  return (
    <WalletTokensContext.Provider value={{ tokens, loading, error, refetch }}>
      {children}
    </WalletTokensContext.Provider>
  );
}

export function useWalletTokens() {
  return useContext(WalletTokensContext);
}
