# Integration Guide — for the frontend track

Audience: Geral and anyone building against the on-chain program from TypeScript.

> **Status: scaffold only.** All instruction handlers compile but return `Ok(())`. You can wire UI calls today and they'll succeed without doing anything; replace this guide with the real call examples once Week 4 lands real handler bodies and the `clients/ts/` Merkle helpers ship.

## What you need

| Thing                       | Where                                                              |
| --------------------------- | ------------------------------------------------------------------ |
| Program ID                  | `G6iaigUdi2btFwUc2N65twfxwA8Ew5uKKhKJ5RJa8wvu`                     |
| IDL (after `anchor build`)  | `target/idl/vesting.json`                                          |
| Generated TS types          | `target/types/vesting.ts` (Anchor 1.0 emits this alongside the IDL)|
| Off-chain Merkle helpers    | `clients/ts/` — *placeholder today, real exports in Week 4*        |

## Setup

```bash
git clone https://github.com/Ah-Riz/mancerxsuperteam-token-vesting.git
cd mancerxsuperteam-token-vesting
git checkout dev_lana          # while Week 3 work isn't yet merged to main
pnpm install
anchor build                   # produces target/idl/vesting.json + target/types/vesting.ts
```

## Connecting from the dApp

```ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../mancer-vesting/target/idl/vesting.json";
import type { Vesting } from "../mancer-vesting/target/types/vesting";

const PROGRAM_ID = new PublicKey("G6iaigUdi2btFwUc2N65twfxwA8Ew5uKKhKJ5RJa8wvu");

// Wallet Adapter gives you a Provider; this is the snippet you'll wrap.
function getProgram(provider: anchor.AnchorProvider) {
  return new anchor.Program<Vesting>(idl as Vesting, provider);
}
```

The IDL exposes camelCase instruction names (Anchor's TS codegen converts snake_case): `createCampaign`, `fundCampaign`, `claim`, `cancelCampaign`, `updateRoot`, `withdrawUnvested`, `pauseCampaign`, `unpauseCampaign`, `closeClaimRecord`, `getVestedAmount`.

## PDA derivations

Every account the program reads/writes is a PDA. The frontend will compute these with `PublicKey.findProgramAddressSync`:

```ts
const enc = new TextEncoder();

// VestingTree (one per campaign)
const [vestingTree] = PublicKey.findProgramAddressSync(
  [
    enc.encode("tree"),
    creator.toBuffer(),
    mint.toBuffer(),
    new anchor.BN(campaignId).toArrayLike(Buffer, "le", 8),
  ],
  PROGRAM_ID,
);

// Vault authority (signs token transfers out of the vault)
const [vaultAuthority] = PublicKey.findProgramAddressSync(
  [enc.encode("vault_authority"), vestingTree.toBuffer()],
  PROGRAM_ID,
);

// ClaimRecord (one per (campaign, beneficiary))
const [claimRecord] = PublicKey.findProgramAddressSync(
  [enc.encode("claim"), vestingTree.toBuffer(), beneficiary.toBuffer()],
  PROGRAM_ID,
);
```

The vault itself is the associated-token-account of `(mint, vaultAuthority)`. Use `getAssociatedTokenAddressSync` from `@solana/spl-token`.

## Calling instructions (when they're real)

**Today** (Week 3 scaffold), these calls succeed but do nothing on-chain. **Week 4** will make them write state.

### Create a campaign (project authority)

```ts
await program.methods
  .createCampaign({
    campaignId: new anchor.BN(1),
    merkleRoot: rootBytes,                  // [u8; 32] — built by clients/ts
    leafCount: recipients.length,
    totalSupply: new anchor.BN(amountTotal),
    cancellable: true,
    cancelAuthority: cancelAuthorityKey,    // PublicKey | null
    pauseAuthority: pauseAuthorityKey,      // PublicKey | null
  })
  .accounts({
    creator: provider.wallet.publicKey,
    mint,
    // vesting_tree, vault, vault_authority resolved by Anchor from seeds
  })
  .rpc();
```

### Claim (recipient)

```ts
await program.methods
  .claim(leaf, proof)                       // VestingLeaf object + [[u8; 32], …]
  .accounts({
    beneficiary: wallet.publicKey,
    mint,
    // tree, claim_record, vault, vault_authority, beneficiary_ata resolved by Anchor
  })
  .rpc();
```

### Cancel a campaign (cancel authority)

```ts
await program.methods.cancelCampaign().accounts({ authority: cancelAuthorityWallet.publicKey }).rpc();
```

> Account lists for the other instructions are isomorphic — see `programs/vesting/src/instructions/<name>.rs` and the brief §6 for the full constraint blocks Week 4 will land.

## Building Merkle proofs (Week 4 — `clients/ts/`)

The off-chain helper API will look roughly like:

```ts
import { buildTree, proofFor, encodeLeaf } from "@mancer-vesting/ts-client";

const leaves = recipients.map(encodeLeaf);
const tree = buildTree(leaves);
const root = tree.root;                     // [u8; 32]
const proof = proofFor(tree, leafIndex);    // [[u8; 32], …]
```

The leaf encoder has to be byte-identical to the Rust `borsh` serialization of `VestingLeaf` — there's a golden-vector test gating that.

## Events (for indexer / UI)

Subscribe via `program.addEventListener("Claimed", (event, slot) => …)`. Available events: `CampaignCreated`, `CampaignFunded`, `Claimed`, `CampaignCancelled`, `RootUpdated`, `UnvestedWithdrawn`, `CampaignPaused`, `CampaignUnpaused`, `ClaimRecordClosed`. Field shapes in `programs/vesting/src/events.rs`.

## Devnet deployment

The program isn't deployed to devnet yet — that lands at the end of Week 5. Until then, `anchor test` boots a local validator with the program preloaded, and you can run a frontend against it via `solana-test-validator` on `127.0.0.1:8899`.

## Where to ask

- On-chain bugs / instruction questions → Lana, surface in `programs/vesting/`.
- Off-chain Merkle / leaf encoding → Lana, surface in `clients/ts/`.
- IDL / TS types regen → re-run `anchor build`; the `target/types/vesting.ts` artifact is what makes the methods type-safe.
