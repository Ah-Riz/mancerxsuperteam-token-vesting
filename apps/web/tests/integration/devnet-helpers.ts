import { readFileSync } from "node:fs";
import {
  AnchorProvider,
  BN,
  Program,
  type Idl,
} from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { IDL, derivePda } from "@/lib/anchor/client";
import { VESTING_ERROR_CODES } from "@/lib/anchor/errors";

type WalletLike = {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
};

type SingleStreamArgs = {
  creator: Keypair;
  beneficiary: Keypair;
  mint: PublicKey;
  amountRaw: string;
  campaignId: number;
  releaseType: 0 | 1 | 2;
  startTime: number;
  cliffTime: number;
  endTime: number;
  milestoneIdx: number;
  cancellable?: boolean;
};

export type SingleStreamFixture = {
  creator: Keypair;
  beneficiary: Keypair;
  outsider: Keypair;
  mint: PublicKey;
  creatorAta: PublicKey;
  treePubkey: PublicKey;
  treeAddress: string;
  vault: PublicKey;
  vaultAuthority: PublicKey;
  amountRaw: string;
  campaignId: number;
  leaf: {
    leaf_index: number;
    beneficiary: PublicKey;
    amount: BN;
    release_type: number;
    start_time: BN;
    cliff_time: BN;
    end_time: BN;
    milestone_idx: number;
  };
};

let campaignCounter = 0;

export function getDevnetConnection() {
  return new Connection(
    process.env.DEVNET_RPC_URL || clusterApiUrl("devnet"),
    "confirmed",
  );
}

export function loadKeypairFromEnv(name = "DEVNET_KEYPAIR"): Keypair {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  const content = value.trim().startsWith("[")
    ? value
    : readFileSync(value, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(content) as number[]);
  return Keypair.fromSecretKey(secretKey);
}

export function makeProgram(connection: Connection, signer: Keypair): Program {
  const wallet: WalletLike = {
    publicKey: signer.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (tx instanceof VersionedTransaction) {
        tx.sign([signer]);
      } else {
        tx.partialSign(signer);
      }
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      return Promise.all(txs.map((tx) => wallet.signTransaction(tx)));
    },
  };

  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: "confirmed",
  });

  return new Program(IDL as Idl, provider);
}

export async function ensureSol(
  connection: Connection,
  signer: Keypair,
  minLamports = LAMPORTS_PER_SOL,
) {
  const balance = await connection.getBalance(signer.publicKey, "confirmed");
  if (balance >= minLamports) return;

  const sig = await connection.requestAirdrop(
    signer.publicKey,
    minLamports - balance + Math.floor(LAMPORTS_PER_SOL / 2),
  );
  await connection.confirmTransaction(sig, "confirmed");
}

export async function fundEphemeralSigner(
  connection: Connection,
  creator: Keypair,
  recipient: Keypair,
  lamports = Math.floor(LAMPORTS_PER_SOL / 5),
) {
  if (creator.publicKey.equals(recipient.publicKey)) return;

  const current = await connection.getBalance(recipient.publicKey, "confirmed");
  if (current >= lamports) return;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: creator.publicKey,
      toPubkey: recipient.publicKey,
      lamports: lamports - current,
    }),
  );

  const program = makeProgram(connection, creator);
  await program.provider.sendAndConfirm!(tx, []);
}

export async function createMintFixture(
  connection: Connection,
  creator: Keypair,
  decimals = 6,
  uiSupply = 1_000_000,
) {
  const mint = await createMint(
    connection,
    creator,
    creator.publicKey,
    null,
    decimals,
  );
  const creatorAta = await getOrCreateAssociatedTokenAccount(
    connection,
    creator,
    mint,
    creator.publicKey,
  );
  const amountRaw = BigInt(uiSupply) * 10n ** BigInt(decimals);
  await mintTo(
    connection,
    creator,
    mint,
    creatorAta.address,
    creator.publicKey,
    amountRaw,
  );

  return {
    mint,
    creatorAta: creatorAta.address,
    decimals,
    mintedRaw: amountRaw.toString(),
  };
}

export function nextCampaignId() {
  campaignCounter += 1;
  return Number(`${Date.now().toString().slice(-6)}${campaignCounter}`);
}

export async function createSingleStreamFixture(
  connection: Connection,
  args: Omit<SingleStreamArgs, "campaignId"> & { campaignId?: number },
): Promise<SingleStreamFixture> {
  const creator = args.creator;
  const beneficiary = args.beneficiary;
  const outsider = Keypair.generate();
  await fundEphemeralSigner(connection, creator, beneficiary);
  await fundEphemeralSigner(connection, creator, outsider);

  const mintFixture = await createMintFixture(connection, creator);
  const campaignId = args.campaignId ?? nextCampaignId();
  const mint = mintFixture.mint;
  const creatorProgram = makeProgram(connection, creator);
  const [treePubkey] = derivePda([
    "tree",
    creator.publicKey.toBuffer(),
    mint.toBuffer(),
    new BN(campaignId).toArrayLike(Buffer, "le", 8),
  ]);
  const [vaultAuthority] = derivePda(["vault_authority", treePubkey.toBuffer()]);
  const vault = getAssociatedTokenAddressSync(mint, vaultAuthority, true);

  await creatorProgram.methods
    .createStream({
      campaignId: new BN(campaignId),
      beneficiary: beneficiary.publicKey,
      amount: new BN(args.amountRaw),
      releaseType: args.releaseType,
      startTime: new BN(args.startTime),
      cliffTime: new BN(args.cliffTime),
      endTime: new BN(args.endTime),
      milestoneIdx: args.milestoneIdx,
      cancellable: args.cancellable ?? true,
      cancelAuthority: args.cancellable === false ? null : creator.publicKey,
      pauseAuthority: creator.publicKey,
    })
    .accounts({
      creator: creator.publicKey,
      vestingTree: treePubkey,
      vaultAuthority,
      vault,
      sourceAta: mintFixture.creatorAta,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return {
    creator,
    beneficiary,
    outsider,
    mint,
    creatorAta: mintFixture.creatorAta,
    treePubkey,
    treeAddress: treePubkey.toBase58(),
    vault,
    vaultAuthority,
    amountRaw: args.amountRaw,
    campaignId,
    leaf: {
      leaf_index: 0,
      beneficiary: beneficiary.publicKey,
      amount: new BN(args.amountRaw),
      release_type: args.releaseType,
      start_time: new BN(args.startTime),
      cliff_time: new BN(args.cliffTime),
      end_time: new BN(args.endTime),
      milestone_idx: args.milestoneIdx,
    },
  };
}

export async function claimSingleStream(
  connection: Connection,
  fixture: SingleStreamFixture,
) {
  const beneficiaryProgram = makeProgram(connection, fixture.beneficiary);
  const [claimRecord] = derivePda([
    "claim",
    fixture.treePubkey.toBuffer(),
    fixture.beneficiary.publicKey.toBuffer(),
  ]);
  const beneficiaryAta = getAssociatedTokenAddressSync(
    fixture.mint,
    fixture.beneficiary.publicKey,
  );

  const sig = await beneficiaryProgram.methods
    .withdraw({
      releaseType: fixture.leaf.release_type,
      startTime: fixture.leaf.start_time,
      cliffTime: fixture.leaf.cliff_time,
      endTime: fixture.leaf.end_time,
      milestoneIdx: fixture.leaf.milestone_idx,
    })
    .accounts({
      beneficiary: fixture.beneficiary.publicKey,
      vestingTree: fixture.treePubkey,
      claimRecord,
      vaultAuthority: fixture.vaultAuthority,
      vault: fixture.vault,
      mint: fixture.mint,
      beneficiaryAta,
    })
    .rpc();

  return { sig, claimRecord, beneficiaryAta };
}

export async function setMilestoneReleased(
  connection: Connection,
  fixture: SingleStreamFixture,
  milestoneIdx: number,
) {
  const creatorProgram = makeProgram(connection, fixture.creator);
  return creatorProgram.methods
    .setMilestoneReleased(milestoneIdx)
    .accounts({
      creator: fixture.creator.publicKey,
      vestingTree: fixture.treePubkey,
    })
    .rpc();
}

export async function cancelStream(
  connection: Connection,
  creator: Keypair,
  treePubkey: PublicKey,
) {
  const creatorProgram = makeProgram(connection, creator);
  return creatorProgram.methods
    .cancelCampaign()
    .accounts({
      cancelAuthority: creator.publicKey,
      vestingTree: treePubkey,
    })
    .rpc();
}

export async function pauseStream(
  connection: Connection,
  creator: Keypair,
  treePubkey: PublicKey,
) {
  const creatorProgram = makeProgram(connection, creator);
  return creatorProgram.methods
    .pauseCampaign()
    .accounts({
      pauseAuthority: creator.publicKey,
      vestingTree: treePubkey,
    })
    .rpc();
}

export async function fetchTree(
  connection: Connection,
  treePubkey: PublicKey,
) {
  const creator = loadKeypairFromEnv();
  const program = makeProgram(connection, creator);
  return (program.account as any).vestingTree.fetch(treePubkey);
}

export async function fetchClaimRecord(
  connection: Connection,
  beneficiary: PublicKey,
  treePubkey: PublicKey,
) {
  const creator = loadKeypairFromEnv();
  const program = makeProgram(connection, creator);
  const [claimRecord] = derivePda([
    "claim",
    treePubkey.toBuffer(),
    beneficiary.toBuffer(),
  ]);
  return (program.account as any).claimRecord.fetch(claimRecord);
}

export async function tokenBalance(
  connection: Connection,
  ata: PublicKey,
) {
  const account = await getAccount(connection, ata, "confirmed");
  return Number(account.amount);
}

export function uiAmountToRaw(amount: number, decimals = 6) {
  return (BigInt(amount) * 10n ** BigInt(decimals)).toString();
}

export function currentUnix() {
  return Math.floor(Date.now() / 1000);
}

export function expectErrorCode(error: unknown, code: number) {
  const text = error instanceof Error ? error.message : String(error);
  const hex = `0x${code.toString(16)}`;
  const name = Object.entries(VESTING_ERROR_CODES).find(([, value]) => value === code)?.[0];
  const decimal = String(code);

  if (!text.includes(hex) && !text.includes(decimal) && (!name || !text.includes(name))) {
    throw new Error(`Expected error code ${code} (${hex}), got: ${text}`);
  }
}
