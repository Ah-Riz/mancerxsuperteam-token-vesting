"use client";

import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

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

export function WalletProvider({ children }: { children: React.ReactNode }) {
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
