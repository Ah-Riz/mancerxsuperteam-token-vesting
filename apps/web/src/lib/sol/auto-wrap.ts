import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

export const NATIVE_SOL_MINT = SystemProgram.programId;
export const NATIVE_SOL_MINT_ADDRESS = NATIVE_SOL_MINT.toBase58();
export const WRAPPED_SOL_MINT = NATIVE_MINT;
export const WRAPPED_SOL_MINT_ADDRESS = WRAPPED_SOL_MINT.toBase58();

export function isNativeSol(mint: string | PublicKey): boolean {
  const key = typeof mint === "string" ? mint : mint.toBase58();
  return key === NATIVE_SOL_MINT_ADDRESS;
}

export function isWrappedSol(mint: string | PublicKey): boolean {
  const key = typeof mint === "string" ? mint : mint.toBase58();
  return key === WRAPPED_SOL_MINT_ADDRESS;
}

export async function buildWrapSolInstructions(
  connection: Connection,
  payer: PublicKey,
  lamports: number,
): Promise<TransactionInstruction[]> {
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, payer);
  const ixs: TransactionInstruction[] = [];

  const ataInfo = await connection.getAccountInfo(ata);
  if (!ataInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(payer, ata, payer, NATIVE_MINT),
    );
  }

  ixs.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: ata,
      lamports,
    }),
  );

  ixs.push(createSyncNativeInstruction(ata));

  return ixs;
}

export function solToLamports(amount: string, decimals: number): number {
  return Math.floor(Number(amount) * Math.pow(10, decimals));
}
