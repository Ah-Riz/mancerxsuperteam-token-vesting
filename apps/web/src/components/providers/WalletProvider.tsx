"use client";

import {
  ConnectionProvider,
  WalletContext,
  WalletProvider as SolanaWalletProvider,
  type WalletContextState,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { PublicKey } from "@solana/web3.js";

// Phantom, Solflare, Backpack all implement wallet standard — auto-detected.
// No need for @solana/wallet-adapter-wallets (omnibus with many outdated deps).
const RAW_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? "https://api.devnet.solana.com";

function resolveRpcEndpoint() {
  // Helius devnet keys are easy to rate-limit during local QA because the app
  // performs many read-after-write fetches. Prefer public devnet in local
  // development unless explicitly opting back into the custom endpoint.
  if (
    process.env.NODE_ENV !== "production" &&
    RAW_RPC_ENDPOINT.includes("devnet.helius-rpc.com") &&
    process.env.NEXT_PUBLIC_USE_HELIUS_DEVNET !== "true"
  ) {
    return "https://api.devnet.solana.com";
  }

  return RAW_RPC_ENDPOINT;
}

const RPC_ENDPOINT = resolveRpcEndpoint();
const E2E_MOCK_WALLET_KEY = "velthoryn:e2e-wallet";
const E2E_MOCK_PUBLIC_KEY = "28FQ5wVeihjGnZw93RctyAtUdtBdd6vGXWUkke49mEAw";

function e2eMockWalletEnabled() {
  if (typeof window === "undefined") return false;
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  return isLocalhost && window.localStorage.getItem(E2E_MOCK_WALLET_KEY) === "1";
}

const mockPublicKey = new PublicKey(E2E_MOCK_PUBLIC_KEY);
const mockWalletContext: WalletContextState = {
  autoConnect: false,
  wallets: [],
  wallet: null,
  publicKey: mockPublicKey,
  connecting: false,
  connected: true,
  disconnecting: false,
  select: () => {},
  connect: async () => {},
  disconnect: async () => {},
  sendTransaction: async () => {
    throw new Error("E2E mock wallet cannot send transactions.");
  },
  signTransaction: async (transaction) => transaction,
  signAllTransactions: async (transactions) => transactions,
  signMessage: async () => new Uint8Array(64),
  signIn: undefined,
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  if (e2eMockWalletEnabled()) {
    return (
      <ConnectionProvider
        endpoint={RPC_ENDPOINT}
        config={{ commitment: "confirmed", disableRetryOnRateLimit: true }}
      >
        <WalletContext.Provider value={mockWalletContext}>
          {children}
        </WalletContext.Provider>
      </ConnectionProvider>
    );
  }

  return (
    <ConnectionProvider
      endpoint={RPC_ENDPOINT}
      config={{ commitment: "confirmed", disableRetryOnRateLimit: true }}
    >
      <SolanaWalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
