# Week 2 Submission — Team 7 Architecture Document

**Developers:** Lana (Smart Contract / Backend) & Geral Tritama Wahyuady (Frontend / Integration)  
**Team:** 7  
**Due:** 2026-05-02  

> **About this document:** This is the combined Week 2 architecture deliverable for Team 7. It is detailed enough that either developer could begin coding from it on Monday, and clear enough for BD teammates and scholarship reviewers to follow the user flow without needing live translation. Lana owns the on-chain architecture (accounts, instructions, validations, math). Geral owns the frontend, integration layer, off-chain Merkle builder, and the data-flow / sequence diagrams. Joint sections (tech stack, testing, edge cases) note who drafted and who reviewed.

The document follows the task brief's acceptance criteria in order: (1) account structure, (2) program instructions, (3) data flow diagrams, (4) tech stack with reasoning, (5) edge cases, plus BD-facing material so the BD team can verify how validated user problems map to architecture.

---

## 1. Product Summary (for non-technical readers)

We are building a token-distribution protocol on Solana designed to automate large-scale token allocation with minimal cost and maximum transparency.

A project — usually a DAO, a game studio, or someone running a token launch — uses this protocol to hand out tokens to a long list of recipients on a schedule (vesting). Vesting matters because if you give everyone their tokens at once, half of them sell on day one. Vesting unlocks tokens gradually, which protects the project and keeps incentives long-term.

The validated problem is that token distribution today is still largely manual and opaque, leaving both admins and recipients with no automated execution and no real-time visibility into what is happening with their tokens. Manual processes introduce human error, security liabilities, and accountability gaps that directly threaten project runway and contributor trust — confirmed by 7 out of 8 users interviewed in Week 2.

The defining choice in our design is Merkle compression. Most existing protocols (Streamflow, Bonfida, Zebec, Magna) open one on-chain storage account per recipient. We don't. We commit a single 32-byte cryptographic root on-chain that stands in for the entire recipient list, and each recipient carries a short proof off-chain that says, in effect, "I'm on the list for this amount on this schedule." The numbers are stark: distributing to 10,000 recipients costs about $0.42 on this design versus $1,990 on Streamflow/Bonfida or $11,730 on Zebec — roughly a 4,700× cost reduction. Without that cost gap there's no reason to build this; with it, community-scale distributions become economical for the first time.

Based on validated user research from Week 2 interviews — 8 users covering active DAO treasury managers (Zidan — whose wallet compromise turned a 3-day execution into 7–8 days), airdrop recipients (Ferdinand — who learned about 80% vesting only on claim day), multisig operators (Yan Tirta — managing across 6 countries with zero automation), grant recipients (Dzikran — waiting up to 22 days for milestone payouts with no notification), pre-launch builders (Vito, Shagbaor, Harfi), and DevRels (Alex — observing that 1 distributor to 5,000 users is the core scalability problem). The validated problem statement is confirmed by 7/8 users, and the four features below are prioritized by direct user evidence:

Three product features make it into v1 — they map directly to BD's Week 2 feature ranking:

1. **Automation (Bulk Send) — Top Priority.** 5/8 users ranked automation first. The project sets up the campaign once, recipients pull their tokens themselves, and the program enforces the schedule. Bulk Send is the highest-impact starting point because it directly solves the 1-to-many scalability problem identified across all interviews.
2. **Transparency / Real-Time Dashboard — Second Priority.** 4/8 users lack visibility into distribution timelines and vesting terms. Every state change emits an event and every account field is publicly readable. This is a trust-building mechanism — users like Ferdinand and Dzikran experienced real harm from the absence of proactive notification.
3. **Standard Vesting Mechanisms — Cliff, Linear, Milestone.** Campaign-level options applied uniformly across all recipients (not per-recipient customization, which was explicitly rejected during validation — only 2/8 users wanted it, both pre-launch).
4. **Automatic Clawback — Safety Net.** If a campaign is canceled, recipients retain already vested tokens; the remainder returns to the project after a 7-day grace period. Directly addresses the operational disruption Zidan faced when contributors left and tokens stayed stuck in multisig wallets.

The program supports cliff, linear, and milestone-based vesting at the campaign level. BD's note was that users weren't very excited about per-recipient customization, so we're not headlining custom mixing as a v1 differentiator — but supporting all three turns out to be basically free architecturally (one byte per leaf, one match expression in claim), so we ship them as the program's foundational vesting model.

**What it looks like end to end**
Picture a DAO — call it MancerDAO — handing out tokens to 5,000 community contributors. Different roles get different schedules: the founding team is on a 1-year cliff then 2 years of linear vesting, growth contributors get milestone-based unlocks tied to deliverables, and hackathon winners get simple cliffs. Here's what actually happens, step by step:

1. MancerDAO prepares the recipient list off-chain. A spreadsheet, a CSV — whatever they already use. Each row has a wallet, an amount, and a schedule. Geral's tooling turns that list into a Merkle tree and gives back a single 32-byte root, plus one small proof file per recipient (~1 KB each).
2. MancerDAO calls `create_campaign` with that root, the total token amount, and the mint. The program creates one PDA, one vault, and one vault-authority — that's the entire on-chain footprint, regardless of whether there are 50 recipients or 50,000.
3. MancerDAO calls `fund_campaign`. Tokens move from their wallet into the vault. From this point, MancerDAO can't touch the tokens anymore — only the program can move them.
4. Recipients get their proof file, typically through a site Geral builds (or pinned on IPFS). They don't have to do anything else until they're ready to claim.
5. A recipient claims by visiting the site and signing one transaction. The program verifies their proof against the stored root, calculates how much has vested for them right now, and sends them their share. They can come back later for more as time unlocks.
6. The dashboard stays current in real time because every claim emits an event. Anyone can subscribe to those events and show recipients their state without having to ask MancerDAO.
7. If MancerDAO ever needs to cancel — say a contributor leaves — they call `cancel_campaign`. Vesting freezes at that moment. Recipients still claim whatever they'd already earned, no exceptions. After 7 days, MancerDAO can sweep what's left back into their wallet.

That's the whole protocol from the outside. The next sections are what's underneath it.

---

## 2. Account Structure Diagram (Acceptance Criterion #1 — Lana)

A five-account model holds the entire campaign state on-chain:

| Account | Purpose | Lifetime |
|---|---|---|
| **VestingTree** | One PDA per campaign. Holds the Merkle root, total supply, total claimed, optional `cancelled_at` timestamp, mint, vault address, and cancel authority. | Lives for the full campaign. |
| **VaultAuthority** | A PDA that signs token transfers out of the vault. Has no data — only seeds. | Same as the VestingTree. |
| **Vault** | An SPL token account owned by `VaultAuthority`. Holds the locked tokens. | Same as the VestingTree. |
| **ClaimRecord** | One PDA per (VestingTree, beneficiary) pair. Holds `claimed_amount` and a 256-bit milestone bitmap. Initialized lazily on the recipient's first claim. | Closeable once the schedule completes; rent refunds to the recipient. |
| **Beneficiary ATA** | The recipient's existing associated token account for the campaign's mint. | External — owned by the recipient. |

*Five accounts total, regardless of recipient count. The Merkle root is what makes that bound hold.*

---

## 3. Program Instructions (Acceptance Criterion #2 — Lana)

Each instruction has its full Anchor 1.0 accounts block, parameter signature, validation order, state changes, and error variants in the architecture doc. The high-level summary is below — Geral has the detail he needs to start coding from the doc itself.

| Instruction | Signer | What it does |
|---|---|---|
| `create_campaign` | Project creator | Initializes the `VestingTree` PDA, vault, and vault authority. Commits the Merkle root and `total_supply`. |
| `fund_campaign` | Project creator | Transfers `total_supply` tokens into the vault. From this point, the project no longer holds the tokens — only the program can move them. |
| `claim` | Beneficiary | The hot path. Verifies the recipient's Merkle proof against the stored root, computes vested amount from the per-leaf schedule (branches on `release_type ∈ {Cliff, Linear, Milestone}`), computes claimable as `vested − already_claimed`, updates state, and CPIs the SPL Token transfer signed by the vault-authority PDA. If `cancelled_at` is set, `now` is clamped to `cancelled_at` so recipients keep exactly what was vested at the cancel instant. |
| `cancel_campaign` | Cancel authority | Sets `cancelled_at` to the current slot timestamp. No tokens move. Subsequent claims clamp `now` to `cancelled_at` so recipients keep exactly what was vested at the cancel instant. |
| `withdraw_unvested` | Project creator | Sweeps remaining tokens back to the creator after a 7-day grace period following cancellation. |
| `close_claim_record` | Beneficiary | Closes the `ClaimRecord` PDA when fully claimed; refunds rent to the recipient. |
| `get_vested_amount` | (read-only) | Returns the current vested amount for a leaf. Dual-exported as both a `pub fn` (for linked-crate callers) and an Anchor instruction (for cross-program CPI callers) so the same logic serves both paths. |

> **A naming note:** the task brief uses Streamflow's per-stream vocabulary for examples (`create_stream`, `withdraw`, `cancel`). Our model is a Merkle-distributor variant — one campaign holds many recipients' leaves — so the instructions are named for that shape: `create_campaign` (was `create_stream`), `claim` (was `withdraw`), `cancel_campaign` (was `cancel`), plus `withdraw_unvested` for the post-cancel sweep. Same surface area, different model.

### 3.1 Supporting code (Lana)

- **`VestingError` enum** — about 25 error variants covering every failure mode of the seven instructions. Each variant has a human-readable message that surfaces in the client.
- **Six `#[event]` structs** — `CampaignCreated`, `CampaignFunded`, `Claimed`, `CampaignCancelled`, `UnvestedWithdrawn`, `ClaimRecordClosed`. Indexers subscribe to these to power the BD-validated "Tracking Status" feature.
- **Constants** — `GRACE_PERIOD_SECS = 7 days` (the window between `cancel_campaign` and `withdraw_unvested` so recipients can claim what they earned), `MAX_MILESTONES = 256` (matches the `ClaimRecord` bitmap width and supports the Milestone schedule branch), `LEAF_PREFIX = 0x00`, `NODE_PREFIX = 0x01`.
- **Merkle helpers** — `leaf_hash` and `verify_merkle_proof` Rust implementations using `solana_program::keccak`, plus a TypeScript counterpart Geral can drop into the off-chain tree builder so on-chain and off-chain hashes stay byte-equal. The `LEAF_PREFIX = 0x00` and `NODE_PREFIX = 0x01` byte tags are second-preimage-attack defenses borrowed from Jito's distributor.
- **Security checklist** — eleven categories cross-checked against Helius's "Hitchhiker's Guide to Solana Program Security": signer checks, account ownership, PDA bump canonicalization, type cosplay, arbitrary CPI, integer overflow, reentrancy, `init` vs `init_if_needed`, double-claim prevention, frontrunning, event emission. Each maps to a named test case for the Week 4 test plan.

---

## 4. Data Flow Diagrams (Acceptance Criterion #3 — Geral)

Geral created a three-level DFD plus a Section 0 Happy Path Overview that maps directly to the task brief's sentence: "user creates stream → tokens locked in PDA → time passes → recipient claims tokens."

| Level | Output | What it captures |
|---|---|---|
| **Section 0** | Flowchart LR 4-step overview | Maps the brief's naming to our Merkle architecture (stream → campaign + leaf) so the reviewer understands terminology without reading the full document. |
| **Level 0 (Context)** | Entity-external diagram | Three actors: Sender, Recipient, Off-chain/IPFS. The system as a single circle. Shows the Merkle Root + Merkle Proof flow pattern. |
| **Level 1 (Decomposition)** | 5 process bubbles | Bulk Send & Automation (P1), Real-Time Tracking & Transparency (P2), Claim Verification (P3), Automatic Clawback (P4), Pause/Close (P5). Plus 5 data stores that exactly match Lana's account model: D1A `VestingTree`, D1B `ClaimRecord` (lazy init), D1C `VaultAuthority` (no-data), D2 `Vault`, D3 Beneficiary ATA. |
| **Level 2A (Create Deep Dive)** | Drill into `create_campaign` + `fund_campaign` split | Off-chain Merkle Builder → Sender → on-chain init → atomic deposit. |
| **Level 2B (Claim Deep Dive)** | Drill into claim 5-step flow | Merkle Proof verification (`keccak`), `u128` safe math + clamp `now = min(now, cancelled_at)`, `init_if_needed ClaimRecord` (first-touch identity), CPI `invoke_signed` via `VaultAuthority` → Beneficiary ATA. |
| **Level 2C (Cancel/Clawback)** | Drill into `cancel_campaign` + `withdraw_unvested` 7-day grace | Phase 0 (cancel with zero token movement) → Phase 1 (grace window — recipients can still claim) → Phase 2 (sweep). Includes timeline phase blocks so BD understands the chronological order. |

*Key design principle: every diagram is traceable to (a) Lana's account model, (b) Lana's instructions, and (c) BD-validated problems. No element floats without a connection.*

### 4.1 Section 0 (User Flow)

The official task brief described the basic flow as: a user creates a stream → tokens get locked → time passes → the recipient claims their tokens. Our system follows exactly that flow, with one twist: instead of one storage record per recipient, we use a single compressed "master list" that stands in for thousands of recipients at once. That's where the cost savings come from. 

> [Access the diagram here](https://drive.google.com/file/d/130C9bOc61i2wF61Cdtcca6LVfrixjpK6/view?usp=sharing)

The four steps are:
1. **Step 1 — Setup.** A project uploads its list of recipients and selects a standard vesting schedule for the campaign (Cliff, Linear, or Milestone-Based Unlock), then locks the tokens. We compress the whole list into a single 32-byte fingerprint (called a Merkle Root) that stands in for thousands of records — that's the cost-saving trick.
2. **Step 2 — Lock.** The tokens sit inside a vault that nobody can directly open. The vault is like a lock-box with a timer: only the protocol's logic, running on Solana, can release tokens, and only when the schedule allows.
3. **Step 3 — Wait.** Time passes. Recipients can watch their schedule progress on a live dashboard — they don't need to message the project team to ask "when?".
4. **Step 4 — Claim.** When tokens are due, the recipient clicks "Claim," provides a small cryptographic receipt that proves they're on the original list, and the protocol sends them their share.

### 4.2 DFD Level 0 (Context) - Who talks to Whom

At the highest level, the system has three groups of users plus an outside helper. 

> [Access the diagram here](https://drive.google.com/file/d/1b_zomanNP3M3q00yQqQ_saAdl-mHbyeA/view?usp=sharing)

Three actors and one helper:
- **Sender (the project).** The team running the campaign — a DAO, a game studio, a token-launch team. They upload the recipient list, fund the vault, and (if needed) cancel the campaign later.
- **Recipient (the beneficiary).** The individual who's been promised tokens. They watch the dashboard, click "Claim" when ready, and receive tokens to their wallet.
- **The smart contract** on Solana sits in the middle. It enforces the schedule, holds the vault, and is the only thing that can move tokens.
- **Off-chain helper (Pinata, an IPFS-based file host).** A free filing cabinet outside the smart contract. It holds the original recipient list and the per-recipient receipts (proofs). It's outside the contract because storing 10,000 records on-chain would cost ~$1,990; storing them off-chain costs about $0.

That last point is the whole reason this design exists. Without the off-chain helper, the cost story breaks. Recipients pull their own proof from the helper before claiming — no project intervention required.

### 4.3 DFD Level 1 - How It Works in Detail

> [Access the diagram here](https://drive.google.com/file/d/1tS3Bw7WD7WwzB12IMwYF4pEy6hUoZxyY/view?usp=sharing)

The 5 jobs the system performs:
1. **Bulk Send & Schedule.** Receive the project's list of recipients and lock the funded tokens in a single campaign. The project selects a standard vesting option (Cliff, Linear, or Milestone-Based Unlock) applied uniformly across all recipients — enabling 1-to-many distribution without manual one-by-one transactions.
2. **Real-Time Tracking.** Continuously broadcast every change as an event so the dashboard updates live — recipients never need to ask the project team "when?".
3. **Claim.** When a recipient asks to withdraw, verify their receipt, calculate what they've earned, and pay them.
4. **Clawback.** When a project cancels, freeze the timer; let recipients claim what they've earned during a 7-day safety window; sweep the rest back to the project after that.
5. **Pause / Cleanup.** Allow an emergency halt without permanent cancellation, and let recipients close their per-person record once they're fully paid (refunding the small storage deposit back to them).

The 5 storage units (everyday descriptions):
- **Campaign config record** — holds the master list fingerprint, the total tokens locked, the cancel timestamp (if any), and the pause flag.
- **Per-recipient claim ledger** — created the first time a recipient claims; tracks how much they've already received, so they can't double-claim.
- **The signing key** — a special address that the program controls; nobody has the private key for it. This is what lets the protocol move tokens without any human signing.
- **The token vault** — the actual locked bucket of tokens, owned by the signing key above.
- **Recipient's regular wallet token account** — the recipient's own existing place to receive tokens, which they already control.

*(Glossary, used once below: a **PDA** is a program-controlled address with no human owner; an **ATA** is a recipient's standard token receiving address; a **CPI** is a contract calling another contract.)*

### 4.4 DFD Level 2 - Deep Dive

Three moments are worth zooming into because they carry most of the design decisions.

#### DFD Level 2A — Creating a Campaign
When a project sets up a campaign, two things happen: configuration is recorded on-chain, and tokens get locked. The cost-saving trick is that the on-chain configuration only stores a single 32-byte fingerprint — no matter whether the campaign has 10 recipients or 10,000.

> [Access the diagram here](https://drive.google.com/file/d/1MF4thG2ZZuwIdbeWBXOyPfrWuR4XvFB5/view?usp=sharing)

**Why this matters:** the off-chain builder is what turns a $1,990 setup into a $0.42 setup. Everything downstream depends on this step working correctly.

#### DFD Level 2B - Claiming Tokens
When a recipient claims, the program runs a verify-then-pay sequence. The recipient brings a short cryptographic receipt proving they're on the original list; the program checks the receipt, calculates how much they've earned so far, and sends that amount.

> [Access the diagram here](https://drive.google.com/file/d/1zA-wLPad9cb5W3WhNerJ0OLvleDTlzxb/view?usp=drive_link)

The 5 steps:
1. **Check the receipt.** Is this person really on the list, with this amount and schedule?
2. **Calculate vested amount.** How much have they earned so far based on the schedule and current time?
3. **Open or update the personal ledger.** First-time claimers get a new ledger row. Returning claimers update theirs.
4. **Subtract what's already claimed.** Pay only the difference.
5. **Send the tokens.** The protocol moves tokens from the vault to the recipient's wallet.

**Why this matters:** verification is mathematical, not human. There's no project admin who could approve or reject a claim. The protocol decides — fairly and consistently — for every recipient.

#### DFD Level 2C - Cancelling with a 7-Day Grace Period
Cancelling needs to be fair to both sides. If a project cancels because a contributor leaves, that contributor still deserves what they've already earned. But the project should be able to recover the unearned remainder. We solve this with a one-week safety window.

> [Access the diagram here](https://drive.google.com/file/d/1zZO5uLMOZpZ0IX4_dyEjGd_4ySaBtdGl/view?usp=drive_link)

The fairness rule: when the project hits cancel, no tokens move that instant. Instead, the protocol records the cancellation time. For the next 7 days, recipients can still claim — and the protocol calculates their share as if time stopped at the cancellation moment. After 7 days, the project can sweep whatever's left in the vault back to itself.

**Why this matters:** recipients keep what they've already earned. Projects can't cancel mid-stream and zero out a fair portion. The 7-day window gives recipients enough time to act without leaving the project's funds locked indefinitely.

---

## 5. End-to-End Sequence Diagram (Geral)

The sequence diagram covers the full 4-phase lifecycle (Create+Fund → Time Passes → Claim → Cancel/Clawback) with participants:

`Sender → Frontend (Dashboard) → Off-chain Builder & IPFS → Solana Program → VestingTree PDA → Vault → ClaimRecord PDA → SPL Token Program → Beneficiary ATA → Recipient`

Each phase narration explains the standard flow versus our innovations (Merkle compression, 8 events, Merkle Proof verification, 7-day grace clamp). Explicit mapping to the validated problems from Week 2 BD interviews.

This is what happens, in order, from start to finish, across all four phases of a campaign's life.

> [Access the diagram here](https://drive.google.com/file/d/1nXnhMHdHZc5kd7l2HtM302L0KcFhjbEg/view?usp=sharing)

The four phases:
1. **Phase 1 — Create and Fund.** The project uploads its recipient list, the off-chain helper builds the master fingerprint and stores the receipts, then the project locks the tokens into the vault. Two transactions: one to record the configuration, one to deposit tokens. Splitting them keeps each step easy to audit.
2. **Phase 2 — Time Passes.** Recipients connect their wallets, the dashboard fetches their personal receipt from the off-chain helper, and shows them a live progress view of what's vested, what's claimed, and what's claimable now. The dashboard updates automatically when on-chain events arrive.
3. **Phase 3 — Claim.** The recipient clicks "Claim." The program checks their receipt, calculates how much they've earned so far minus what they've already taken, and transfers the difference to their wallet. The dashboard updates in seconds.
4. **Phase 4 — Cancel or Cleanup.** Three sub-flows here: a project cancellation (with the 7-day grace window described above), an emergency pause and unpause (reversible — temporarily blocks claims without changing the schedule), and a final cleanup where a fully-paid recipient closes their personal ledger and gets back the small storage deposit.

---

## 6. Tech Stack Decisions (Acceptance Criterion #4)

### 6.1 Anchor 1.0 vs Native vs Pinocchio (joint — Lana drafted)

We picked Anchor 1.0 (April 2026 release) for v1. Reasoning:
- Anchor 1.0 is the first stable major release; default test runtime is LiteSVM, which removes the validator-boot tax that made earlier Anchor versions slow to iterate on.
- Major audit firms (Halborn, OtterSec, Sec3) routinely audit Anchor programs. Picking Anchor 1.0 over Native or Pinocchio for v1 isn't about CU cost — claim is well under the 200 K compute-unit budget already. It's about how the code reads to a reviewer.
- Pinocchio earns ~84% CU savings but the savings only matter once we're CU-bound. Pinocchio is Phase 2 if CU pressure becomes real.
- Native Solana means writing every account validation by hand — slower to ship, easier to mis-validate. Anchor's declarative constraints (`#[account(mut, has_one = …, seeds = …, bump)]`) catch a class of bugs at compile time.

### 6.2 Frontend & Integration Stack (Geral)

Six categories with per-category detail (chosen tool + reasoning + rejected alternatives + hand-off constraint from Lana):

| # | Category | Choice |
|---|---|---|
| A | Frontend Framework | Next.js 15 (App Router) + React 19 |
| B | UI & Styling | Tailwind CSS v4 + Shadcn UI + Radix Primitives |
| C | Solana Integration | `@solana/web3.js` v2 + `@coral-xyz/anchor` + Wallet Adapter + `@solana/spl-token` (RPC: Helius primary, Alchemy fallback) |
| D | State / Data Fetching | Zustand (client) + TanStack Query v5 (chain) + Anchor IDL types |
| E | Off-chain Merkle | `merkletreejs` + `keccak256` + Pinata IPFS |
| F | Frontend Testing | Vitest + React Testing Library + Playwright + LiteSVM bridge |

### 6.3 Off-chain Merkle Builder + IPFS Pinning Strategy (Geral)

Core design:
- TypeScript Builder = `merkletreejs` + custom `hashFn` that injects `LEAF_PREFIX = 0x00` & `NODE_PREFIX = 0x01` byte tags (anti second-preimage defense, same pattern as the Jito distributor reference).
- Leaf encoding uses Borsh little-endian, consistent with Lana's Rust struct — same endianness, same field order.
- Pinata IPFS for pinning `proofs.json` per campaign (~10KB / 100 recipients), global gateway latency <100ms.
- Day 1 Week 3 test gate: unit test comparing output of `keccak256(LEAF_PREFIX || leaf)` in TypeScript vs Rust → must be byte-equal. This is the baseline before any instruction wiring begins.

### 6.4 Standard Vesting Mechanisms (Geral)

The Week 2 BD validation produced a critical finding: per-recipient customizable vesting was rejected as a core feature. Only 2 out of 8 users (Vito and Harfi) prioritized it, and both are pre-launch with no active distribution. The majority defaulted to wanting basic cliff and linear vesting first, with milestone-based unlocking as a supported concept they did not prioritize. As a result, the protocol implements three standard vesting mechanisms applied at the campaign level — not per-recipient customization.

#### 6.4.1 Cliff Vesting
All tokens are locked until a specified cliff date. After the cliff date passes, the full allocation becomes claimable in a single unlock. This mechanism ensures long-term commitment before any tokens are released — for example, DAO contributor vesting where the team requires a 6-month commitment period before any tokens are claimable.
- **Campaign-level setting:** The cliff duration is set once at campaign creation and applies to all recipients in that campaign uniformly.
- **BD evidence:** Shagbaor explicitly requested "schedule-based vesting with a cliff to ensure long-term commitment, uniform vesting schedules across all contributors."

#### 6.4.2 Linear Vesting
Tokens unlock gradually over time at a constant rate from the start date to the end date. A recipient can claim the vested portion at any point — no discrete unlock events, just a smooth linear curve. This is the most common vesting model for ongoing contributor relationships.
- **Campaign-level setting:** The start date, end date, and total allocation are set once per campaign. Every recipient in the campaign unlocks tokens at the same rate.
- **BD evidence:** Zidan's DAO uses time-based vesting tracked manually in Google Sheets — the need is for automated linear vesting, not per-contributor customization.

#### 6.4.3 Milestone-Based Unlock
Tokens unlock in discrete tranches when predefined milestones are reached. Unlike time-based vesting, milestone unlock requires the admin to verify and trigger each milestone externally before the protocol releases the next tranche. The protocol enforces the admin's verified decision trustlessly — it does not make the judgment about whether a milestone was completed.
- **Campaign-level setting:** The milestone schedule (unlock percentages and total number of milestones) is set at campaign creation. Milestone triggers are initiated by the admin.
- **BD evidence:** Dzikran receives milestone-based grants from Cardano Project Catalyst. Harfi's GameFi model needs level-based rewards. Yan Tirta's main challenge is KPI-based contributor accountability — milestone unlock maps directly to this need.

#### 6.4.4 Why Standard, Not Per-Contributor
The BD rejection insight is clear: customized vesting per contributor does not meet the bar for a core feature in the first version. The majority of users (6/8) defaulted to wanting basic cliff and linear first. Per-recipient customization introduces complexity that directly conflicts with the top priority — bulk send. If each recipient has a different schedule, the Merkle tree must encode per-leaf schedule data, which increases tree construction complexity, proof size, and on-chain verification cost. Standard vesting keeps the tree simple: one schedule type per campaign means one uniform rule, enabling the 1-to-many distribution that solves the core problem. Per-recipient customization is deferred to a future iteration once the automation and transparency layer is stable.

### 6.5 Testing Strategy (joint — Lana drafted backend pyramid, Geral drafted frontend pyramid)

- **Backend pyramid (Lana):** five layers — `cargo test` for pure logic → Mollusk for instruction-level tests → LiteSVM (via `anchor-litesvm`) for in-process integration → Surfpool (anchor test) for full-validator end-to-end → `proptest` and `cargo-fuzz` for math and Merkle-proof verification.
- **Frontend pyramid (Geral):** Vitest unit tests for the Merkle builder and bigint vested-preview math → React Testing Library for component behavior → Playwright for end-to-end browser flows → LiteSVM bridge test that spawns the in-process validator, deploys Lana's program, and runs full `create → fund → claim` from the frontend side.

**Joint test gate, Week 3 Day 1:** unit test comparing `keccak256(LEAF_PREFIX || leafBorsh(...))` output in TypeScript against a golden hex from Lana's Rust implementation — must be byte-equal. This is the single test that gates everything else: if it fails, every claim in production fails proof verification.

---

## 7. Edge Cases (Acceptance Criterion #5 — joint, Lana drafted, Geral reviewed)

Lana drafted the edge cases from the smart-contract perspective. Geral reviewed each from the frontend angle — how the UI must handle them so the user experience remains clear and safe. The table below covers all five scenarios named in the task brief plus three additional cases surfaced during integration design. Backend coverage continues into a 13-case fuzz / property suite (overflow on amount × elapsed, clock skew, milestone bitmap exhaustion, tampered-leaf proofs, cross-campaign proof submission) tracked separately for the Week 4 test plan.

| # | Scenario | Backend Behavior (Lana) | Frontend Handling (Geral) |
|---|---|---|---|
| 1 | Withdraw before cliff | `claim` computes `vested = 0` for the Cliff branch when `now < cliff_ts`. Returns `Ok(0)` rather than erroring so the caller sees "nothing to claim" cleanly. | Claim button disabled + countdown timer showing time remaining until cliff ends. Client-side bigint preview shows "0 claimable" so user understands why. |
| 2 | Cancel mid-stream | `cancel_campaign` sets `cancelled_at = clock.unix_timestamp`. Subsequent `claim` calls clamp `now = min(now, cancelled_at)` so vested amounts freeze at the cancel instant. After 7-day grace, `withdraw_unvested` becomes callable. | Dashboard switches to cancelled state: shows 7-day grace countdown, claimable amount clamped to `cancelled_at` timestamp, and "Campaign Cancelled" banner. Claim button stays active during grace window. |
| 3 | Zero amount claim | `claim` returns early with `Err(VestingError::NothingToClaim)` if `vested - claimed_amount == 0`. Prevents wasted CPI and keeps event log clean. | Frontend pre-calculates `vested - claimed_amount` before building the transaction. If result is zero, Claim button is disabled with tooltip "Nothing to claim yet." Prevents wasted transaction fees. |
| 4 | Expired stream (fully vested) | `claim` continues to work after `end_ts`; vested is capped at `total_amount` for the leaf. Once `claimed_amount == total_amount`, `close_claim_record` becomes callable to refund rent. | Shows "Fully Vested" badge. If unclaimed balance remains, Claim button active for final withdrawal. After full claim, prompts recipient to close `ClaimRecord` and recover rent deposit. |
| 5 | Same recipient and creator | No special path — `create_campaign` does not block `creator == beneficiary`. The Merkle proof and PDA seeds resolve normally. (Common case: founder vesting to themselves.) | No special UI treatment — protocol allows `sender = recipient` (e.g., founder vesting to themselves). Dashboard detects this and shows both Sender and Recipient views on the same page. |
| 6 | ATA does not exist | `claim` requires the Beneficiary ATA as a writable account; Anchor's `associated_token::AssociatedToken` constraint can `init_if_needed` it inside the same transaction if the client opts in. | Before submitting claim, frontend calls `getAssociatedTokenAddressSync` to check if Beneficiary ATA exists. If missing, auto-creates it in a bundled transaction (or separate tx if needed). User sees "Creating token account..." step. |
| 7 | Campaign paused | `pause_campaign` sets a `paused: bool` flag on `VestingTree`. `claim` returns `Err(VestingError::CampaignPaused)` while the flag is true. Vesting math is unaffected — only token movement is blocked. | Claim button disabled, dashboard shows "Campaign paused by admin" message. Schedule progress continues visually (vesting doesn't stop — only claims are blocked). Unpause re-enables Claim. |
| 8 | IPFS proof unavailable | (Off-chain; on-chain code never sees this path. The proof is supplied as instruction data by the caller.) | Graceful timeout handling: if Pinata gateway fails, show "Proof loading failed" with retry button. After first successful fetch, proof is cached in browser `localStorage` to avoid repeat dependency on IPFS gateway. |

---

## 8. Trade-offs Considered

### 8.1 Backend Trade-offs (Lana)

| Choice | Rejected alternative | Why |
|---|---|---|
| **Merkle-compressed campaigns** | One PDA per recipient (Streamflow / Bonfida pattern) | Cost for 10,000 recipients: roughly $0.42 vs. $1,990. The cost gap is the protocol's reason to exist. |
| **Static keccak Merkle verifier** | `spl-account-compression` concurrent Merkle tree | We never update leaves on-chain — the `ClaimRecord` PDA carries the mutable claim state, so the tree itself is immutable. The static verifier is cheaper and simpler. |
| **One `ClaimRecord` per (tree, beneficiary) plus a 256-bit milestone bitmap** | One PDA per leaf | Keeps rent at roughly 0.0024 SOL per beneficiary regardless of milestone count up to 256. Cleaner state machine for partial linear claims. |
| **`get_vested_amount` dual-exported (`pub fn` + Anchor instruction)** | One or the other | A `pub fn` is cheap for linked-crate callers (other Anchor programs in the same workspace). The Anchor instruction is required for cross-program CPI callers. Both export the same logic. Pattern adopted from `anchor-spl::token::transfer`. |
| **`cancelled_at: Option<i64>` (timestamp clamp)** | `cancelled: bool` | A timestamp threads the cancel through the existing claim math with a single extra clamp (`now = min(now, cancelled_at)`). A bool would force a separate post-cancel claim path. Recipients keep exactly what was vested at the cancel instant — which addresses BD's "Clawback Otomatis" without weaponizing it against recipients. |
| **7-day grace period before `withdraw_unvested`** | Immediate sweep on `cancel_campaign` | Recipients need a window to claim what they earned before the vault closes. Seven days mirrors common EVM clawback patterns. |
| **`init_if_needed` on `ClaimRecord` with first-touch initialization** | A separate `init_claim_record` instruction | Saves the recipient one transaction on their first claim. Documented gotcha: `init_if_needed` allocates the PDA but skips the constructor on subsequent calls, so the handler must seed identity fields explicitly only on first touch — otherwise the second claim clobbers state. |
| **`u128` intermediate in the linear-vested math** | Direct `u64 × i64` | `amount × elapsed` overflows `u64` for realistic values; `u128` is safe across the full input range. Verified with `proptest`. |
| **`LEAF_PREFIX = 0x00` / `NODE_PREFIX = 0x01` byte tags** | Bare `keccak` | Defends against second-preimage attacks where a leaf hash collides with an internal-node hash. Jito's distributor uses the same pattern; we copy it verbatim so client tooling stays interchangeable. |
| **Anchor 1.0 (April 2026 release)** | Anchor 0.30 / Native / Pinocchio | Anchor 1.0 is the first stable major release; default test runtime is LiteSVM, which removes the validator-boot tax. Major audit firms (Halborn, OtterSec, Sec3) routinely audit Anchor programs. Pinocchio earns ~84% CU savings but claim is well under the 200 K compute-unit budget already; Pinocchio is Phase 2 if CU pressure becomes real. |

### 8.2 Frontend Trade-offs (Geral)

| Choice | Rejected alternative | Why |
|---|---|---|
| **Next.js 15 App Router (SSR + Server Actions)** | Vite SPA, Remix, Astro | SEO for the landing page requires SSR (BD finding: communication gap → educational landing must appear on Google). Server Actions handle the off-chain Merkle build without a separate Express server. 90% of Solana TS tooling examples use Next.js → zero friction. |
| **Anchor IDL → TS auto-generated types** | Hand-rolled TypeScript instruction encoder | IDL is the single source of truth from anchor build. If Lana changes a `claim()` parameter, the frontend gets a compile error automatically. Without this, schema drift causes production bugs. |
| **Zustand + TanStack Query split** | Redux Toolkit, single global store | Separating client state (wallet, modal) from chain state (account data) creates a clearer mental model. TanStack Query handles stale-while-revalidate + automatic invalidation when indexer events arrive. Redux boilerplate wastes Week 3 time. |
| **Pinata IPFS** | Web3.Storage (Storacha), self-hosted IPFS, Arweave | Pinata API is stable with low global gateway latency; free tier is sufficient for the MVP. Web3.Storage pivoted to Storacha in 2024–2025 — risk of breakage. Self-hosted IPFS = DevOps burden for a 2-dev team. Arweave at $0.50/MB is overkill for re-pinnable JSON proofs. |
| **Wallet Adapter (Solana Foundation standard)** | Custom wallet connect | Wallet Adapter covers Phantom, Solflare, Backpack, and Ledger out of the box plus mobile deep-link. Bypassing it means re-implementing the modal + signing flow — a 2-week time sink. |
| **Off-chain Merkle build** | On-chain `spl-account-compression` | `spl-account-compression` is designed for mutable leaves; our leaves are immutable (proofs don't change after creation). Lana already rejected this in her spec. I aligned by using a static `merkletreejs` + custom `hashFn` injecting `LEAF_PREFIX`/`NODE_PREFIX`. |
| **JavaScript bigint for client-side vested preview** | Calling `get_vested_amount` instruction on every UI render | Bigint preview on the client is sub-millisecond; an RPC round-trip is ~200ms. Use bigint for the "claimable now" preview + verify via instruction on actual claim (hybrid). This aligns with Lana's dual-export of `get_vested_amount` (`pub fn` + Anchor instruction). |
| **`merkletreejs` library** | Hand-rolled Merkle in TS | High risk of hash inconsistency with a hand-roll. `merkletreejs` is battle-tested (Uniswap, Optimism) + supports custom `hashFn` & sort options matching Solana convention `{ hashLeaves: false, sortPairs: false }`. |
| **Vitest + LiteSVM bridge for joint testing** | Spawning `solana-test-validator` per test run | Validator boot takes 30–60s = CI > 10 minutes per PR. LiteSVM in-process runs in <1s = CI < 90s. Lana's backend already uses LiteSVM in its test pyramid → reuse infrastructure, not a dual runtime. |

---

## 9. Work Split

| Area | Lana | Geral | Joint |
|---|---|---|---|
| Account structure diagram | ✅ | | |
| Program instructions & validations | ✅ | | |
| Data Flow Diagram (Level 0/1/2) | | ✅ | |
| Sequence Diagram (4-phase end-to-end) | | ✅ | |
| Frontend & Integration tech stack | | ✅ | |
| Off-chain Merkle Builder + IPFS strategy | | ✅ | |
| Standard Vesting Mechanism specs | | ✅ | |
| Anchor 1.0 vs Native + Backend Testing | ✅ draft | | ✅ joint |
| Frontend Testing pyramid (Vitest + Playwright + LiteSVM bridge) | | ✅ | |
| Edge cases | ✅ draft | review | ✅ joint |

*How we split works: Lana owns the on-chain architecture (structs, instruction signatures, validation, math). Geral owns the frontend stack + user flow (DFD/Sequence) + Off-chain Merkle Builder TS (which will be pair-tested on Week 3 Day 1 to ensure byte-equal hashes vs Rust). Edge cases were drafted by Lana; Geral reviewed them from the frontend angle (whether the UI handles them gracefully). The reviewer scores each developer individually from git contributions, so this document keeps the authorship of each section explicit.*

---

## 10. Insights

### 10.1 Lana's insights (backend perspective)

- **The 4,700× cost reduction is the entire reason the protocol exists.** A 10,000-recipient airdrop costs around $0.42 on this design versus ~$1,990 on Streamflow / Bonfida and ~$11,730 on Zebec. Without Merkle compression, the BD-validated "Automatisasi — Send" feature is economically impossible at community scale. This was the gap thesis from the Week 1 research, now hardened into the account schema.
- **One per-leaf `release_type` byte covers all three vesting flavors at once.** Cliff, Linear, and Milestone schedules mix freely inside a single campaign — projects don't need three separate campaigns to give different cohorts different schedules. The on-chain code path is `match leaf.release_type { 0 | 1 | 2 => … }` and nothing fancier; the schedule shape lives in the leaf encoding, not in the runtime. It's a foundational capability of the program, not a marketed v1 headline — BD found that user interest in customization was muted, but supporting all three costs us one byte per leaf and one match expression, so we ship it.
- **Storing `cancelled_at` as a timestamp instead of a boolean is the small choice I'm proudest of.** A bool would have meant writing a second code path for "claim after cancel." A timestamp lets the existing claim math do the work — one extra `min(now, cancelled_at)` clamp and you're done. The contract says "you keep what was vested up to the cancel moment," and the code says exactly that, in one line. It also matters for BD's trust-barrier finding: clawback ships, but the clamp guarantees recipients can't lose what was already vested. We bound the trust cost instead of pretending it isn't there.
- **Anchor 1.0's `init_if_needed` has a first-touch initialization gotcha I haven't seen documented anywhere official.** The constraint allocates the PDA but doesn't seed the user fields. The handler has to check if `cr.beneficiary == Pubkey::default()` and only then assign identity fields, otherwise the second claim clobbers state. I documented the canonical idiom inline in the claim instruction so reviewers and the dev partner can see it without having to rediscover it.
- **Dual-exporting `get_vested_amount` was a cheap win.** Cross-program CPI callers need an Anchor instruction; anything inside our workspace gets by with a plain `pub fn`. Exporting both — same logic, two entry points — costs nothing and keeps the function reusable from either side. The pattern is borrowed from `anchor-spl::token::transfer`, which does the same thing.
- **Audit firms care more about Anchor's declarative constraints than they do about saving compute units.** Picking Anchor 1.0 over Native or Pinocchio for v1 isn't about CU cost — claim is well under the 200K budget already. It's about how the code reads to a reviewer. Halborn, OtterSec, and Sec3 audit Anchor programs every day; we want to be that kind of program when audits come. Pinocchio is the right call for Phase 2 hot paths once we're live and CU pressure is actually real.

### 10.2 Geral's insights (frontend / integration perspective)

- **The off-chain Merkle build is the heart of the 4,700× cost reduction.** Without a TypeScript builder that is correct byte-by-byte, Merkle Compression breaks — the frontend would submit a Merkle Root that doesn't match the recipient's proof, and every claim fails verification. The biggest investment on Day 1 of Week 3 is ensuring `keccak256(LEAF_PREFIX || leafBorsh(...))` output in TypeScript equals the Rust output, byte-for-byte. This is not "my task" separate from Lana — it is a pair task that must pass a test gate before anything else is built.
- **Anchor IDL → TS type generation eliminates an entire class of schema-drift bugs.** Every time Lana adds a field to an account or changes a parameter, TypeScript immediately errors on any frontend code still using the old shape. Without this pattern, "field name mismatch" bugs appear in staging → 30-minute debug sessions per incident. With the IDL: zero incidents of this class.
- **Real-time dashboard is a trust mechanism, not a nice-to-have** — and it is our second priority feature. The BD validation made this clear: 4 out of 8 users lack visibility into distribution timelines and vesting terms. Ferdinand learned about 80% vesting only on claim day. Dzikran tracks distribution informally via Discord every few days with no proactive notification. Zidan confirmed that contributors cannot track their own vesting status without asking the team directly. The Real-Time Dashboard feature directly addresses this pain: Helius RPC + WebSocket events push all 8 on-chain events in real time via Anchor's `addEventListener` + TanStack Query cache invalidation — recipients never need to ask the team "when?" because the dashboard answers it automatically.
- **ATA derivation on the client BEFORE submitting claim is an often-overlooked edge case.** The Beneficiary ATA must exist (via `getAssociatedTokenAddressSync`, which is deterministic) before the CPI transfer. If it doesn't exist, the instruction fails. The UI must detect + auto-create the Associated Token Account via a separate transaction if needed (or bundle it in the same transaction). I noted this in the tech stack document so that the Week 3 implementer (myself) does not forget.
- **Next.js 15 Server Actions for the off-chain Merkle build reduce the attack surface.** The CSV upload doesn't need to hit an external endpoint or run a client-side build (which could be tampered with by browser extensions). A stateless Server Action on Vercel edge → sender uploads → server builds root → returns root + IPFS CID. The sender reviews the root before submitting on-chain. Fewer moving parts = less audit area.
- **Cross-team naming consistency is a primary discipline.** The Week 2 brief originally used `create_stream` / `withdraw` / `cancel` (Streamflow's vocabulary). Lana already renamed to `create_campaign` / `claim` / `cancel_campaign` (Merkle-distributor vocabulary) in her spec. I enforced the same naming across the DFD, Sequence Diagram, Tech Stack, and local README scripts. When the reviewer reads three documents, they all speak the same language — no confusion over "is this a stream or a campaign?"
- **Trust in third-party protocols is the baseline barrier, not a nice-to-have.** Across Lyn's Week 1 interviews, nearly every user mentioned hesitation around unaudited contracts and fear that distributions could be redirected. Vito (CTO, Alphabit) put it most directly: "di DeFi kita tidak bisa percaya siapa pun... selama protokol kalian bersifat open-source dan transparan, maka ini bisa dipercaya." Our architecture directly addresses this: the VaultAuthority PDA is keyless (no human can redirect funds), all 8 events are publicly verifiable, and the Merkle Proof verification is mathematical — no human approver exists in the claim flow.
- **Solana's cost structure validates our chain choice.** Edrico (Lyn, Week 1) specifically flagged Ethereum-based tools as impractical for smaller distributions due to gas fees. Multiple users responded positively to a Solana-based solution. Our numbers confirm this: Solana transaction fees are ~$0.00025, and Merkle compression brings the total cost for 10,000 recipients to $0.42 — a 4,700× improvement over Ethereum-based alternatives. This is not a marginal advantage; it's what makes the product category viable.
- **Multiple users requested auto-release instead of manual claim — we chose claim-based for principled reasons.** Rini's Week 1 research found that both Ghoza and Dzikran independently expressed a preference for tokens to be automatically released after vesting without requiring manual action. Our architecture uses a claim-based model instead because: (a) auto-push to 10,000 wallets would require a crank/keeper, adding centralization risk and operational cost; (b) claim-based puts the recipient in control of when tokens arrive in their wallet (tax timing, wallet security); and (c) the Merkle Proof model inherently requires the recipient to present their proof, which naturally maps to a pull/claim pattern. This is a deliberate trade-off we should revisit if user feedback in Weeks 4–6 shows claim friction is high.
- **Bulk Send is risk mitigation, not just convenience.** Zidan's wallet compromise turned a 3-day execution into 7–8 days — a 2.5× time cost with direct security implications. Alex identified that "1 distributor to 5,000 users is the core scalability problem." The 5/8 users who ranked automation first are not asking for a faster way to do what they already do; they are describing a process that actively breaks under real conditions. Bulk Send via Merkle compression converts a manual, error-prone, multi-day process into a single campaign creation transaction. This is why it is the top priority: it turns an operational risk into a protocol guarantee.
- **Standard vesting beats per-recipient customization for the first version — and the data proves it.** The BD team explicitly tested "customized vesting as a core feature" and it failed validation. Only Vito and Harfi wanted it, and both are pre-launch with no active distribution. The remaining 6/8 users defaulted to wanting basic cliff and linear first. Beyond user demand, there is an architectural reason: per-recipient customization conflicts with bulk send. If each leaf in the Merkle tree encodes a different schedule, tree construction complexity and on-chain verification cost increase materially. Standard vesting (one schedule type per campaign) keeps the tree simple and the cost at $0.42 for 10,000 recipients — the exact cost advantage that makes this protocol viable. Per-recipient customization is deferred to a future iteration once the automation and transparency layer is stable.

---

## 11. BD Problem ↔ Architecture Mapping (Geral — for BD Reviewers)

For BD reviewers who want a quick verification. Each row directly connects a validated user problem from Week 2 interviews to the architecture component that solves it, with the corresponding priority feature.

| Validated Problem (Week 2 BD) | Priority Feature | What the DFD / Tech Stack Solves | Research Evidence (Week 2) |
|---|---|---|---|
| **#1 — Manual distribution creates operational risk** (6/8 users) | 1. Automation (Bulk Send) — Top Priority | DFD Level 1 P1 (Off-chain Merkle Builder + Server Action CSV upload → tree root). The Sender Dashboard replaces manual one-by-one transactions with a single campaign creation that funds thousands of recipients at once via Merkle compression. | Zidan: wallet compromise turned a 3-day execution into 7–8 days — a 2.5× time cost with direct security implications. Alex: "1 distributor to 5,000 users is the core scalability problem." Yan Tirta: fully manual via Google Docs + multisig across 6 countries. Shagbaor: wants automation because it "removes third-party manual handling and directly improves transparency." Vito: wants claim automated first. 5/8 users ranked automation as top priority. |
| **#2 — Recipients lack visibility and notification** (4/8 users) | 2. Transparency / Real-Time Dashboard — Second Priority | DFD Level 1 P2 + Tech Stack §6.2D (TanStack Query + Anchor event listener) → real-time Recipient Dashboard. 8 on-chain events push updates automatically — recipients never need to ask the team "when?" or rely on Telegram/Discord for status. | Ferdinand: learned about 80% vesting only on claim day — "Ga dibilang ada vesting dan tiba-tiba ada vesting jadi kecewa aja." Dzikran: tracks informally via Discord every few days, no automated notification when milestone is approved or funds are released. Zidan: contributors cannot track their own vesting status without asking the team directly. |
| **#3 — Need for standard vesting, not per-contributor customization** (BD rejection: only 2/8 wanted customization) | 3. Standard Vesting Mechanisms (Cliff, Linear, Milestone) | DFD Section 0 step ② + DFD Level 1 P1 — Campaign creation offers three standard vesting options (Cliff, Linear, Milestone) applied uniformly across all recipients. See §6.4 for full mechanism details. Standardization enables bulk send: one schedule type per campaign means the Merkle tree encodes a uniform rule, keeping cost at $0.42 for 10K recipients. | BD rejection insight: customized vesting was tested and failed — only Vito and Harfi wanted it, both pre-launch with no active distribution. The majority defaulted to basic cliff and linear first. Shagbaor: prefers schedule-based vesting with a cliff, uniform across all contributors. Dzikran: receives milestone-based grants from Cardano Catalyst. Harfi: GameFi needs level-based rewards. |
| **#4 — No automatic clawback when contributors leave** | 4. Automatic Clawback — Safety Net | DFD Level 2C (`cancel_campaign` + 7-day grace + `withdraw_unvested`). Recipients keep vested tokens; project recovers the rest after a 7-day grace period. Sender Dashboard shows 7-day countdown timer. | Zidan: when a contributor's wallet was compromised, tokens stayed in the multi-sig and access had to be manually revoked — "we had to get everyone on board again, vote again." Shagbaor: experienced a contributor leaving early with no token mechanism in place. Zidan ranked automatic clawback as his top feature priority. |
| **#5 — Late vesting term disclosure** | (Addressed by Feature 2 — Dashboard) | Sender Dashboard shows full campaign config (schedule type, cliff, duration, total supply) at creation time. Recipient Dashboard shows vesting terms immediately upon wallet connection — before any claim action. | Ferdinand: learned about 80% vesting only on claim day — "no one told him before he claimed." Uprock disclosed the 80/20 split only on the day of claim. Dzikran: distribution can be delayed if the weekly schedule is missed, with no proactive notification. |
| **#6 — Milestone verification is manual** | (Addressed by Merkle Proof verification) | Claim verification (on-chain): DFD Level 2B P3.1 — Merkle Proof verification via `keccak` is 100% mathematical with zero human approver. Milestone completion verification (off-chain): the protocol does not judge whether a milestone was completed — it enforces the admin's verified decision trustlessly. Workflow: admin verifies milestone externally → creates Merkle tree with correct allocations → protocol distributes without further human intervention. | Yan Tirta: main challenge is contributor performance accountability. Dzikran: delayed 22 days from milestone submission to grant receipt because the weekly distribution schedule was missed and no one notified him. |
| **#7 — Trust in third-party protocols is the baseline barrier** | (Architecture-wide: open-source, keyless vault, mathematical verification) | Entire protocol is on-chain, open-source, mathematical verification via Merkle Proof. VaultAuthority PDA is keyless — no human can redirect funds. All 8 events are publicly verifiable. No admin approval in the claim flow. | Zidan: uses multisig specifically because trust is fundamental — when trust broke down (wallet compromise), the entire process stalled for 7–8 days. Vito (W1): "di DeFi kita tidak bisa percaya siapa pun... selama protokol kalian open-source dan transparan, maka ini bisa dipercaya." Shagbaor: wants automation because it removes third-party manual handling and directly improves transparency. |
| **#8 — Gas fees make existing tools impractical** | (Architecture-wide: Solana + Merkle compression) | Tech Stack §6.2C — Solana as base chain (~$0.00025/tx). Merkle compression reduces 10K-recipient setup from $1,990 to ~$0.42. Combined: 4,700× cost reduction. This is what makes the product category viable. | Alex: observed that manual distribution is error-prone in practice, with small test sends needed to verify accuracy — cost and complexity compound the problem. Edrico (W1): "gas fees on existing tools, mostly Ethereum-based, are a barrier especially for small distributions." |

---

## 12. What Happens Next — Week 3 Plan

### 12.1 Lana — Backend Roadmap

Week 3 is implementation week. The doc above is the spec, so most of Lana's time goes into translating it into Rust rather than redesigning anything.

- **Day 1.** Scaffold the `programs/vesting` crate per the layout in the architecture doc. Paste the errors enum and event structs as starter files. Implement `vested()` and `verify_merkle_proof()` helpers with their unit tests.
- **Days 2–4.** Implement the four critical-path instructions in this order: `create_campaign`, `fund_campaign`, `claim`, `cancel_campaign`. Each has its full Anchor accounts block and validation list ready to translate. The `claim` instruction branches on `release_type ∈ {Cliff, Linear, Milestone}`, and each branch ships with integration coverage covering the foundational schedule capability.
- **Days 5–7.** Implement the remaining three (`withdraw_unvested`, `close_claim_record`, `get_vested_amount`). Run the test pyramid against the edge cases: Mollusk for instruction-level fuzz on claim math, LiteSVM for full-flow integration, Surfpool for the validator-class end-to-end.

*Three things are still open: who exactly the cancel_authority should be (probably the DAO multisig, but worth confirming with stakeholders), whether to support Token-2022 in v1 or punt it to Phase 2, and which IPFS host we end up using for proof distribution. None of them block Lana from starting backend work — they're tracked in the weekly report companion file.*

### 12.2 Geral — Repository / Frontend Roadmap

The Week 3 deliverable checklist for the Developer role is: working repository with Anchor project initialized and compiling, program skeleton with empty instruction handlers, account structs defined, README with setup steps, at least 1 passing test, and a CI pipeline (GitHub Actions). Below is how Geral plans to hit every item.

#### Joint / Repository-Level Deliverables
These are shared responsibilities between Lana and Geral. Both contribute to the same monorepo.

1. **Anchor project initialized and compiling.** Day 1: run `anchor init` (or validate Lana's existing scaffold) to confirm `programs/vesting` compiles with `anchor build`. Geral verifies the generated IDL is importable from the frontend workspace (`apps/web`). If the project doesn't compile, nothing else proceeds.
2. **Program skeleton with empty instruction handlers.** Day 1: ensure all 8 instruction handlers (`create_campaign`, `fund_campaign`, `claim`, `cancel_campaign`, `withdraw_unvested`, `pause_campaign`, `unpause_campaign`, `close_claim_record`) exist as named functions with correct Anchor `#[program]` attributes — even if the bodies are initially `Ok(())` stubs. Lana fills in the backend logic; Geral confirms the IDL surfaces all 8 entry points so the frontend can bind to them.
3. **Account structs defined.** Day 1: confirm the 5-account model from the architecture (`VestingTree`, `VaultAuthority`, `Vault`, `ClaimRecord`, Beneficiary ATA) is declared as Anchor `#[account]` structs in the crate. Geral cross-checks field names and types against the byte-level hand-off table (`LEAF_PREFIX`, `NODE_PREFIX`, Borsh LE encoding) to catch mismatches early.
4. **README with setup steps.** Day 1–2: Geral writes the repository `README.md` covering: prerequisites (Rust, Solana CLI, Anchor CLI, Node.js), clone instructions, `anchor build` + `anchor test` commands, frontend dev server (`npm run dev`), and environment variable setup (RPC endpoint, Pinata API key). Lana reviews for backend accuracy.
5. **At least 1 passing test.** Day 1: the Merkle byte-equal test gate — a unit test comparing `keccak256(LEAF_PREFIX || leafBorsh(...))` output in TypeScript against a golden hex from Lana's Rust implementation. This is the first test that must pass before any other work proceeds. Additionally, `anchor test` must have at least 1 green test (even a basic program-loads-successfully test) to satisfy the deliverable.
6. **CI pipeline (GitHub Actions).** Day 2: Geral sets up a `.github/workflows/ci.yml` that runs on every push/PR: (1) `anchor build` to verify the program compiles, (2) `anchor test` to run the Rust test suite, (3) `npm run test` in `apps/web` to run the frontend Vitest suite (including the Merkle byte-equal gate). All three must pass for the pipeline to go green.

#### Frontend-Specific Roadmap
After the repository-level deliverables are secured (Days 1–2), Geral shifts to frontend implementation:

- **Days 2–3.** Scaffold Next.js 15 + Tailwind v4 + Shadcn CLI init. Set up `apps/web` in the monorepo. Implement the Merkle builder in TypeScript (`merkletreejs` + `keccak` + `LEAF_PREFIX`/`NODE_PREFIX`). Wallet Adapter integration: `@solana/wallet-adapter-react-ui` provider, multi-wallet button. Implement the Anchor program client wrapper with `Program+` helper `derivePda(seeds)`.
- **Days 4–5.** Project Dashboard (Sender): `create_campaign` form (upload CSV + Server Action builds Merkle Root + Pinata pins proof + submit on-chain) + `fund_campaign` form. Campaign list for sender via `getProgramAccounts` filtered by `cancel_authority = wallet.publicKey`.
- **Day 6.** Recipient Dashboard: fetch IPFS proof by `(treeRoot, beneficiary)`, compute vested amount client-side with bigint preview, `claim()` button building the instruction. Subscribe to `Claimed` event → invalidate query → UI updates.
- **Day 7.** Joint integration test: Vitest spawns LiteSVM, deploys Lana's program, frontend runs full-flow test: `create → fund → claim`. Assert ATA balance + all 8 events emitted. If this test is green, the Week 3 deliverable is achieved — Weeks 4–6 are feature polish (cancel UI, pause UI, close `ClaimRecord`, milestone bitmap UI).

---

## 13. External References

**Backend (Lana):**
- Jito Distributor reference implementation — closest cost-equivalent prior art: https://github.com/jito-foundation/distributor
- Anchor 1.0 documentation: https://www.anchor-lang.com/docs
- Helius "A Hitchhiker's Guide to Solana Program Security": https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security
- Solana rent formula: https://docs.solana.com/developing/programming-model/accounts#rent
- SOL price reference (cost figures recomputed at ~$85 SOL, verified 2026-04-19): https://coinmarketcap.com/currencies/solana/

**Frontend / Integration (Geral):**
- Solana Cookbook (TS examples): https://solanacookbook.com/
- Anchor TS client docs: https://www.anchor-lang.com/docs/clients/typescript
- Wallet Adapter monorepo: https://github.com/anza-xyz/wallet-adapter
- Solana web3.js v2 migration: https://github.com/anza-xyz/solana-web3.js
- Pinata IPFS docs: https://docs.pinata.cloud/
- TanStack Query v5: https://tanstack.com/query/latest
- Next.js 15 App Router: https://nextjs.org/docs/app
- Shadcn UI components: https://ui.shadcn.com/
- merkletreejs (with custom `hashFn`): https://github.com/miguelmota/merkletreejs
- LiteSVM (in-process Solana validator): https://github.com/LiteSVM/