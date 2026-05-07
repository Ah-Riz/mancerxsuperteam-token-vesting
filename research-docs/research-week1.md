# Week 1 — Technical Research: Solana Token Distribution Protocol

**Team:** Team 7

**Developers:**
- Geral Tritama Wahyuady — [geraltritama33@gmail.com](mailto:geraltritama33@gmail.com)
- Lana — [ahmadrizkimaulana666@gmail.com](mailto:ahmadrizkimaulana666@gmail.com)

**Due:** 2026-04-25

> All USD figures use SOL at ~$85 (checked 2026-04-19). GitHub claims, audit firms, and archival status verified against live repos the same day.

---

## How to Read This Document

This document is written for the whole team — engineering, BD, and Marketing. It covers the technical research using everyday language and real-world analogies alongside the engineering detail, so both audiences can use the same source of truth.

After reading this, you should be able to:

- Explain what "token vesting" means to a potential client in one sentence
- Describe the three main types of vesting (cliff, linear, milestone) and when each is used
- Understand how Solana keeps vesting tokens secure — without touching code
- Know what already exists in the Solana vesting market, what's missing, and why it matters
- Connect every research finding to a specific Week 2 product design decision

> 💡 Look for the 🏷️ green boxes throughout — they contain real-world analogies you can reuse in conversations with leads and partners.

---

## Ownership Map — Who Wrote What

Every section below carries an **Author** tag. At-a-glance breakdown:

| **Section** | **Content** | **Author** |
|---|---|---|
| Glossary (non-technical) | Plain-English definitions for BD/Marketing | **Lana** |
| 1. Three Types of Token Distribution | Cliff, linear, milestone vesting with examples | **Geral** |
| 1.1 What Is Token Vesting? | Vesting overview, who needs it | **Geral** |
| 1.2 Three Types | Cliff / Linear / Milestone subsections | **Geral** |
| 2. Solana's Program Model | Accounts, PDAs, CPIs, storage, transactions, token custody | **Geral** |
| 2.1 Accounts | — | **Geral** |
| 2.2 PDAs | — | **Geral** |
| 2.3 CPIs | — | **Geral** |
| 2.4 Vesting data storage | — | **Geral** |
| 2.5 Transactions | — | **Geral** |
| 2.6 Token custody | — | **Geral** |
| 3. Comparison of Existing Solutions | 6-protocol comparison table + per-protocol analysis | **Lana** |
| 3.1 Comparison table | 18 fields × 6 protocols | **Lana** |
| 3.2 Sources | Repository + site links | **Lana** |
| 3.3 What each one gets wrong | Per-protocol limitations | **Lana** |
| 4. Gaps in the Current Ecosystem | Setup-cost gap + dead-capital gap | **Lana** |
| 5. Product Summary (BD/Marketing) | The 1-paragraph pitch | **Lana** |
| 6. How This Research Shapes Week 2 | Findings → product decisions | **Geral** (rows 1–8) + **Lana** (rows 9–10) |
| 7.1 Individual Report | — | **Geral** |
| 7.2 Individual Report | — | **Lana** |
| 8. Engineering Glossary | PDA, CPI, SPL Token, ATA, Rent, Anchor | **Geral** |
| 9. Appendix — 15-Protocol Deep Research | Nine adjacent protocols + ecosystem analysis | **Lana** |
| References — Lana's list | Section 3–5, 9 sources | **Lana** |
| References — Geral's list | Section 1–2 sources | **Geral** |

---

## Glossary (for Non-Technical Readers)

**Author:** Lana

Read this first if you're on the BD / Marketing side. Every technical term in this document is defined here in plain English.

| **Term** | **Plain-English Meaning** |
|---|---|
| **Token vesting** | Locking tokens so the recipient receives them gradually over time instead of all at once. Common for employees, investors, and airdrop recipients to prevent instant dumping. |
| **Cliff vesting** | Nothing unlocks until a specific date. On that date, a big chunk unlocks at once. (Example: "1-year cliff" = you get nothing for 12 months, then 25% lands on day 365.) |
| **Linear streaming** | Tokens unlock continuously, a tiny bit each second, like water dripping. After 6 months of a 12-month schedule, 50% is claimable. |
| **Milestone vesting** | Tokens unlock when specific events or dates are reached (e.g., "10% at product launch, 20% at 10k users"). |
| **Airdrop** | Distributing free tokens to many wallets at once. Used to reward early users or bootstrap a community. |
| **On-chain / off-chain** | On-chain = recorded permanently on the Solana blockchain (public, expensive). Off-chain = stored in a normal database or file (cheap, private). |
| **Rent / storage fees / storage slot** | Solana charges a fee in SOL to store data on the blockchain. Every piece of data has its own "slot" and costs SOL to keep alive. More recipients = more slots = more rent. This is the main cost driver in this research. |
| **PDA (Program-Derived Address)** | A special kind of on-chain storage slot controlled by a program (smart contract) instead of a person. |
| **Merkle tree / Merkle compression / Merkle proof** | A cryptographic trick that lets **one** on-chain slot stand in for **thousands** of recipients. Instead of every recipient getting their own expensive slot, the project publishes one "fingerprint" on-chain, and each recipient carries a short cryptographic "proof" that says "yes, I'm on the list." Used by Jito's distributor to cut airdrop costs from thousands of dollars to cents. |
| **DeFi (decentralized finance)** | Apps for lending, borrowing, and trading built on-chain, without banks. |
| **Composable / DeFi composability** | A protocol is "composable" when other apps can plug into it (e.g., a lending app can read your locked tokens and accept them as loan collateral). Non-composable tokens are dead weight until they unlock. |
| **DAO** | A community-run project governed by token holders who vote on decisions. |
| **SPL Governance / Realms** | Solana's standard DAO voting system. Projects plug into it to let token holders vote. |
| **Collateral** | An asset pledged against a loan. If you don't repay, the lender keeps it. |
| **SDK / CLI / API** | Different ways developers integrate with a protocol. **SDK** = code library (easiest). **CLI** = command-line tool (manual). **API** = programmatic interface. |
| **Audit** | A third-party security firm reviewing the code for vulnerabilities. Firms mentioned: Halborn, OtterSec, Sec3, Kudelski — all reputable Solana auditors. |
| **Mint** | Creating new tokens on-chain. |
| **Option / option token / strike price / expiry** | An option = the *right* (not obligation) to buy tokens at a set price (strike) before a deadline (expiry). If the deadline passes unused, the option is gone forever. Armada uses this model. |

---

# 1. Three Types of Token Distribution

**Author:** Geral — researched and wrote the full section (1.1 and 1.2, including all three vesting subtypes).

## 1.1 What Is Token Vesting? (And Why Does It Matter?)

Token vesting is a system that releases tokens to people gradually over time, instead of giving them everything at once. It's how crypto projects protect their token price and make sure team members, investors, and community members stay committed long-term.

> 🏷️ **Think of it like a salary:** Your company doesn't pay you 5 years of salary on Day 1. You receive a paycheck every month because you continue working. Token vesting is the same idea — tokens are released over time based on a schedule, so everyone stays motivated.

**Why do projects use vesting?** Without it, early investors could sell all their tokens on day one, crashing the price. Vesting creates trust: "We believe in this project long-term, so we're willing to wait."

### Who Needs Token Vesting?

| **Who** | **Why They Need It** | **Typical Duration** |
|---|---|---|
| Startup team members | Ensures founders and employees stay committed | 2–4 years |
| Early investors (seed/private) | Prevents dumping tokens right after listing | 6–18 months |
| Community airdrops | Rewards loyal users while protecting token price | 3–12 months |
| DAO grants | Pays contributors as they deliver work | 3–6 months per milestone |
| Gaming rewards | Distributes tokens to players over time | Ongoing / seasonal |

> 💡 One-liner for leads: **"Token vesting is a time-lock on tokens — it makes sure everyone has skin in the game before they can sell."**

## 1.2 Three Types of Token Vesting

Every vesting schedule falls into one of three categories. Here's what each one means, when to use it, and how to explain it to someone who has never heard of crypto.

| **Type** | **Description** | **Best For** | **Market Impact** |
|---|---|---|---|
| **Cliff Vesting** | Nothing until a fixed date, then everything at once | Investor lockups, employee retention | Medium — big unlock event can move price |
| **Linear Streaming** | A steady drip, like a salary — released bit by bit every second | Payroll, DAO grants, contributor payments | Low — gradual, no sudden supply shock |
| **Milestone-Based** | Tokens release in chunks when specific goals are hit | Grant programs, VC deals, game rewards | Low — tied to performance, not just time |

### 1.2.1 Cliff Vesting — "All or Nothing"

With cliff vesting, the recipient gets zero tokens until a specific date. On that date, 100% of their allocation becomes available all at once. It's the simplest type of vesting.

> 🏷️ **Like a probation period at work:** You join a company and they promise you a bonus after 12 months. If you leave at month 11, you get nothing. If you stay until month 12, you get the full amount. That's a cliff.

**Real example:** A seed investor buys 500,000 tokens in a new project. The project sets a 6-month cliff. For the first 180 days, the investor cannot access any tokens. On day 181, all 500,000 tokens become available to claim.

**How the logic works:** The system simply checks: "Is today's date past the cliff date?" If no → you get 0 tokens. If yes → you get 100% of your tokens. That's it.

**What BD should know:** Cliff unlocks create "unlock events" — a specific day when a large amount of tokens becomes sellable. This can cause price drops if many investors unlock simultaneously. Tell clients that cliff vesting is best combined with linear vesting (cliff first, then gradual release) to soften the impact.

**Use cases:** Investor lockups (3–12 month cliff), airdrop anti-dump protection, team retention.

### 1.2.2 Linear Streaming — "The Salary Model"

Tokens are released continuously from a start date to an end date. If the schedule is 12 months and 6 months have passed, exactly 50% of tokens are available. It's smooth, predictable, and causes the least market impact.

> 🏷️ **Like a water faucet:** Imagine filling a glass from a faucet. The water flows at a constant rate. You can drink (claim) at any point — whatever has flowed into the glass is yours. The faucet stops when the glass is full (vesting period ends).

**Real example:** A DAO hires a developer and pays them 60,000 USDC over 6 months via streaming. They can withdraw approximately $10,000 per month in real-time. If the DAO cancels the grant at month 3, the developer keeps $30,000 (the portion earned), and $30,000 returns to the DAO treasury.

**How the logic works:** The system calculates: "What percentage of time has passed between start and end?" That percentage equals the percentage of tokens you can claim. 50% of time passed = 50% of tokens available. Simple proportional math.

**Cancellation feature:** If a stream is cancellable, the creator (employer/DAO) can stop the stream at any time. The recipient keeps what's already vested; the rest returns to the creator. Fair for both sides.

**For sales conversations:** "Pay your team in real-time. If someone leaves, you automatically stop paying — no HR paperwork, no claw-back disputes."

### 1.2.3 Milestone-Based — "Pay for Performance"

Tokens are released in batches when specific goals are achieved. This is the most flexible model because payouts are tied to actual deliverables, not just the passage of time.

> 🏷️ **Like a construction contractor:** When you build a house, you don't pay the contractor 100% upfront. You pay 30% when the foundation is done, 30% when the walls are up, and 40% when the house is finished. Each payment is released after inspection.

**Real example:** A game studio receives 300,000 tokens via a grant, split into 3 milestones: 40% on MVP launch (120,000 tokens), 30% on reaching 5,000 users (90,000 tokens), 30% on hitting a revenue target (90,000 tokens). Each milestone is approved by a DAO vote before tokens are released.

**How the logic works:** The system checks each milestone: "Is this milestone approved? And is the unlock date reached?" If both conditions are true, those tokens become claimable. Milestones can be verified in different ways:

| **Verification Model** | **How It Works** | **Example** |
|---|---|---|
| Time-based | Milestone unlocks automatically on a set date (no human approval needed) | Unlock 25% every quarter |
| Authority-based | A designated authority (e.g., DAO multisig) approves each milestone manually | DAO votes to confirm MVP was delivered |
| Oracle-based | A data feed (e.g., price oracle) verifies conditions automatically | Token price hits $X → milestone unlocked |

**For sales conversations:** "Milestone vesting reduces risk: you only pay for results delivered. Perfect for grant programs and investor deals that need accountability."

---

# 2. Solana's Program Model — How Solana Keeps Tokens Secure

**Author:** Geral — researched and wrote the full section (2.1 Accounts, 2.2 PDAs, 2.3 CPIs, 2.4 Vesting data storage, 2.5 Transactions, 2.6 Token custody).

You don't need to understand programming, but knowing the basics of how Solana handles token vesting will help you explain our product with confidence. Here's the non-technical version of every concept the engineering team uses.

## 2.1 Accounts — Where Everything Lives

In Solana, every piece of data — every vesting contract, every token balance, every user record — is stored in something called an "account." Think of accounts as individual files in a giant filing system.

> 🏷️ **Like a spreadsheet:** Imagine the entire Solana blockchain is one massive spreadsheet. Each "account" is a row. One row stores your vesting schedule, another stores the token vault balance, another stores a user's wallet info. Every row has an owner (the program that can edit it) — no one else can touch it.

**Account Types:**

**1. Executable Accounts (Programs/Smart Contracts):**
These contain the actual code and rules. Our Vesting Protocol is an executable account. It doesn't hold the users' tokens; it just holds the logic that says HOW tokens should be released.

**2. Non-Executable Accounts (Data Accounts):**
These store information. A user's vesting schedule, the amount they have claimed, and the tokens themselves are stored here. They are "dumb" files that can only be changed by the programs that own them.

Every account on Solana has four key properties:

| **Property** | **What It Means** | **Why It Matters for Us** |
|---|---|---|
| Balance (lamports) | How much SOL the account holds (for "rent" — storage fees) | Each vesting contract costs a small fee to store on-chain |
| Data | The actual information stored (e.g., "User X gets 50,000 tokens from Jan to June") | This is where the vesting schedule lives |
| Owner | The program (smart contract) that controls this account | Only our vesting program can change vesting data — no tampering |
| Executable | Whether this account is a program itself | Our vesting program is an executable account; data accounts are not |

**Cost reality — "Rent":** Every account on Solana must hold a minimum balance (~$0.35 per vesting contract) to stay alive. This is called "rent." For a small team of 20 people, rent is negligible ($7). For 10,000 community members, it adds up to ~$3,500. This is the cost problem that our Merkle compression approach (designed by our partner's research) solves.

## 2.2 PDAs — "Vaults With No Key"

PDA stands for "Program Derived Address." It's a special type of account that has no private key — meaning no human, hacker, or bot can directly access it. Only the owning program (our vesting smart contract) can authorize actions on it.

> 🏷️ **Like a safe deposit box at a bank — but with no physical key:** Imagine a bank vault where the safe has no key, no combination, no fingerprint scanner. The only way to open it is to follow a set of rules: prove your identity, prove the time conditions are met, and the vault opens automatically. No bank teller, no manager — only the automated verification system can authorize it.

**How PDAs are generated:** A PDA is created by combining several "seeds" (like the creator's ID, the token type, and a label like "vault") and running them through a mathematical function. The result is a unique address on the blockchain. Because there's no private key, only the program that created those seeds can authorize transfers.

**Why this matters for our product:** When a project deposits tokens into a vesting vault, that vault is a PDA. No single person holds the keys. The tokens are genuinely locked — only the vesting program can release them, and only when the schedule allows it.

> 💡 Security pitch for leads: **"Your tokens are locked in a vault that has no key. Only the automated vesting program — which follows the exact rules you set — can release them. Not even we can touch them."**

## 2.3 CPIs — "Programs Talking to Each Other"

CPI stands for "**Cross-Program Invocation**." It's how one program calls another program on Solana. When our vesting program needs to actually move tokens, it calls the standard Solana Token Program and says: "I'm the vault authority (PDA), and I authorize this transfer."

> 🏷️ **Like a manager calling the finance department:** You (the employee) go to your manager and say "I want my bonus." Your manager checks: "Have you completed your probation? Yes." Then the manager calls the finance department: "Please transfer $5,000 to this employee." The finance department checks the manager's authority, verifies the request, and processes the payment. The vesting program is the manager. The Token Program is the finance department.

**The full claim flow:**

1. **User clicks "Claim"** — The user tells the vesting program: "I want my tokens."
2. **Vesting program checks the schedule** — "Is this person eligible? Has enough time passed? How much can they claim?"
3. **Vesting program calls the Token Program (CPI)** — "I'm the vault authority. Transfer X tokens from the vault to this user's wallet."
4. **Token Program verifies** — "Is this really the vault authority? Yes, the PDA matches. Transfer approved."
5. **Tokens arrive** — The user's wallet receives the tokens. Done.

**CPI Methods:**

**1. Standard "invoke":**
This is used when a human user clicks a button and provides their own cryptographic signature. *"I am Geral, and I approve moving my tokens."* The program just passes Geral's signature along to prove authorization.

**2. "invoke_signed" (The Magic of PDAs):**
This is how our automated vaults work. Because our vault has no human owner and no private key, a human cannot sign for it. Instead, our Vesting Program uses invoke_signed to act as an automated robot, signing the transaction on behalf of the keyless vault based on strict rules. This guarantees no human can steal the locked tokens.

## 2.4 How Vesting Data Is Stored

Every vesting contract stores its data as a structured record on the blockchain. Here's what a typical vesting record contains:

| **Field** | **What It Stores** | **Example** |
|---|---|---|
| Creator | Who created this vesting contract | The project's wallet address |
| Beneficiary | Who receives the tokens | The team member's wallet address |
| Token type | Which token is being vested | USDC, SOL, project token, etc. |
| Total amount | How many tokens are locked in total | 500,000 tokens |
| Already withdrawn | How many tokens the user has already claimed | 125,000 tokens |
| Start time | When vesting begins | January 1, 2026 |
| End time | When vesting ends (all tokens claimable) | January 1, 2028 |
| Schedule type | Cliff, Linear, or Milestone | Linear |

**Storage cost:** A typical vesting record is ~138 bytes. That requires about $0.25 in "rent" to keep it alive on the blockchain. When the vesting completes and the account is closed, that rent is refunded — clean and tidy.

## 2.5 How Programs Interact (Transactions)

On Solana, every action happens inside a "transaction." A transaction can contain multiple instructions (steps), and it's all-or-nothing: if any step fails, everything is rolled back. No half-completed operations.

> 🏷️ **Like a bank wire with multiple conditions:** Imagine you set up a wire transfer with two conditions: "Move $10,000 from Account A to Account B, AND update the ledger." If the money moves but the ledger update fails, the entire transaction is cancelled — the money goes back. Solana transactions work the same way. This protects against bugs and partial failures.

**Why this matters:** When a user creates a vesting stream, the system deposits tokens into the vault AND creates the vesting record in a single transaction. If either step fails, nothing happens — you never end up with tokens deposited but no record, or a record with no tokens. It's atomic and safe.

## 2.6 How Tokens Are Held & Released

Solana uses a standardized token system called "**SPL Token**." Tokens aren't stored "inside" your wallet — they're in a separate Token Account linked to your wallet. This is automatic; users don't need to do anything special.

**The three key accounts in the Token System (SPL/Solana Program Library):**

| **Account Type** | **What It Is in Plain English** | **Its Job** |
|---|---|---|
| **Token Program** | The Master Rules Engine | The main software that governs how all tokens on Solana behave. We interact with it whenever tokens need to move. |
| **Mint Account** | The Token Identity | Represents the token itself (e.g., the "USDC" identity). It tracks the total supply in existence and who is allowed to create more. |
| **Token Account** | The User's Digital Pocket | A specific account created just to hold a balance of a specific token for a user. (Also called an **ATA - Associated Token Account**). |

**The complete vesting token flow:**

| **Step** | **What Happens** | **Security Guarantee** |
|---|---|---|
| 1. Create | Project deposits tokens into a PDA-controlled vault | Vault has no key — only the vesting program can access it |
| 2. Lock | Vesting program enforces the schedule — no transfers allowed before time | Schedule rules are baked into the smart contract, cannot be changed |
| 3. Claim | User requests tokens. Program verifies schedule, then transfers to user's wallet | User cannot bypass the schedule or claim more than what's vested |
| 4. Complete | All tokens claimed. Vault and vesting record are closed. Storage fees refunded. | Clean state — no leftover accounts on the blockchain |

**The security guarantee:** The beneficiary can never transfer tokens from the vault without going through the vesting program. The program checks the schedule, then signs the transfer as the vault authority (the PDA). No shortcuts, no backdoors.

---

# 3. Comparison of Existing Solutions

**Author:** Lana — researched all six protocols, built the 18-field comparison table, compiled the sources list, and wrote the per-protocol limitations analysis.

I looked at six Solana vesting and distribution protocols: the two most widely deployed (Streamflow, Zebec), two open-source reference implementations (Bonfida, Jito's distributor), and two niche platforms (Magna, Armada).

## 3.1 Comparison Table

|  | **Streamflow** | **Zebec Protocol** | **Magna** | **Bonfida Token Vesting** | **Armada** | **Jito Distributor** |
|---|---|---|---|---|---|---|
| **Status** | Active | Active | Active | Active (154 commits) | Active | Active (one-shot airdrop tool) |
| **Launched** | 2021 | 2021 | 2022 | 2021 | 2023 | 2023 |
| **How data is stored** | One storage slot per stream | One slot per stream + extra slots per milestone | Shared storage pool with individual claim records | One slot per recipient with a custom unlock schedule | One slot per grant + an option token minted to recipient | Single Merkle root on-chain — one account for the whole campaign |
| **Cliff vesting** | ✅ | ✅ | ✅ | ✅ | ✅ (via option expiry) | ✅ |
| **Linear streaming** | ✅ | ✅ | ✅ | ✅ (discrete steps only) | ❌ | ✅ (post-cliff) |
| **Milestone vesting** | ❌ (UI only, not on-chain) | ✅ | ❌ | ✅ (each schedule entry is a milestone) | ❌ | ❌ |
| **Setup cost per user** | ~$0.37 | ~$1.17 (5 milestones) | ~$0.20 | ~$0.20 | ~$0.20–$0.43 | ~$0 marginal (one-time root) |
| **Total for 10,000 users** | ~$3,720 | ~$11,730 | ~$1,990 | ~$1,990 | ~$1,990–$4,250 | ~$0.20 total |
| **Compression** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Merkle |
| **DeFi apps (lending, trading)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **DAO voting systems** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Transferable claims** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit** | Halborn + OtterSec (2022) | Sec3 + OtterSec | Unknown (closed) | Kudelski | Sec3 (core only; launch-pool unaudited) | /audit folder exists; firm not confirmed |
| **Fee model** | 0.25–0.5% per withdrawal | Not disclosed | B2B subscription | Free (open-source) | % of tokens at launch | None (internal) |
| **Open source** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Developer tools** | TypeScript + Rust SDK | TypeScript SDK | No public API | Rust + JS | TypeScript SDK | Rust + CLI scripts |
| **Primary users** | Individuals, small teams | Teams, grant programs | Enterprise (B2B) | Developers integrating vesting | Token launches | Jito Foundation + forks |
| **Setup UX** | Self-serve; easy for one stream, tedious at scale | Self-serve; no bulk tools | Managed by Magna team | SDK; developer-focused | Product-focused docs | CLI only, no UI |
| **Recipient UX** | Streamflow app or SDK | Zebec app only | Magna dashboard | Integrator's frontend | Must exercise before expiry or forfeit | Merkle proof submission via project frontend |

## 3.2 Sources

| **Protocol** | **Repository** | **Site** | **Accessed** |
|---|---|---|---|
| Streamflow | [https://github.com/streamflow-finance/timelock-crate](https://github.com/streamflow-finance/timelock-crate) | streamflow.finance | 2026-04-19 |
| Zebec | [https://github.com/Zebec-Protocol](https://github.com/Zebec-Protocol) | zebec.io | 2026-04-19 |
| Magna | (closed source) | magna.so | 2026-04-19 |
| Bonfida | [https://github.com/Bonfida/token-vesting](https://github.com/Bonfida/token-vesting) | — | 2026-04-19 |
| Armada (Dual Finance) | [https://github.com/Dual-Finance](https://github.com/Dual-Finance) | armada.ac | 2026-04-19 |
| Jito Distributor | [https://github.com/jito-foundation/distributor](https://github.com/jito-foundation/distributor) | — | 2026-04-19 |

## 3.3 What Each One Gets Wrong

**Streamflow.** Cost scales directly with user count — 10,000 streams = 10,000 storage fees (~$3,720). Milestone vesting shown in the UI isn't actually enforced on-chain. Locked positions are non-transferable and can't be used in DeFi.

**Zebec.** The most expensive of the six. Each milestone adds another storage account, so a 5-milestone campaign for 10,000 users costs ~$11,700 in rent alone. No compression, no DeFi integration.

**Magna.** Closed-source — teams can't audit the on-chain rules. No self-serve, no public API, complete vendor lock-in.

**Bonfida.** Solid primitive and Kudelski-audited, but minimal: no compression, linear streaming is faked with discrete steps (small rounding gaps), non-transferable positions.

**Armada.** Option-based only — recipients must actively exercise before an expiry date or they forfeit their tokens entirely. No linear streaming. The launch-pool code hasn't been independently audited. Confusing UX for anyone expecting a normal vesting schedule.

**Jito Distributor.** Built for the JTO genesis airdrop, now reused for other one-shot airdrops. Uses Merkle compression — the only competitor that does — but it's just the compression primitive: no milestones, no UI, no multi-campaign dashboard, no composability, no governance integration.

What all six share: none expose locked tokens as DeFi primitives, none integrate with Solana governance, and none combine compression economics with a full vesting platform.

---

# 4. Gaps in the Current Ecosystem

**Author:** Lana — identified both gaps from the comparison data, ran the per-recipient cost projections, and wrote the DeFi-composability analysis.

Two structural gaps emerge from the comparison above.

## 4.1 Gap 1 — Setup Costs Price Community Launches Out of the Market

PDA-based protocols charge per recipient because each person needs their own on-chain storage slot. Costs scale linearly with recipient count:

| **Recipients** | **Cheapest PDA (Magna/Bonfida)** | **Zebec (5 milestones)** | **Jito Distributor (Merkle)** |
|---|---|---|---|
| 1,000 | ~$200 | ~$1,170 | ~$0.20 |
| 10,000 | ~$1,990 | ~$11,730 | ~$0.20 |
| 100,000 | ~$19,890 | ~$117,300 | ~$0.20 |

Jito's distributor is the only protocol with Merkle-based compression, keeping setup costs flat regardless of recipient count — but it's a one-shot airdrop primitive with no milestones, no UI, no multi-campaign management, and no composability. The gap: there is no protocol that combines Jito's cost efficiency with a full vesting platform (cliff + linear + milestone) and a real developer/recipient UX.

## 4.2 Gap 2 — Locked Tokens Sit as Dead Capital

Every existing protocol freezes tokens completely until they vest. Across all six:

- Recipients cannot use locked tokens as loan collateral
- Recipients cannot earn yield on locked tokens
- Recipients cannot transfer or sell a vesting position
- No protocol integrates with Solana DAO governance (SPL Governance / Realms) so locked tokens can count toward voting weight

The gap: no Solana vesting protocol treats vesting positions as composable DeFi primitives.

---

# 5. Product Summary (for BD/Marketing)

**Author:** Lana — wrote the 1-paragraph summary using the cost figures and gap analysis from Sections 3 and 4.

Every crypto project rewarding its community — DAOs, games, startups — needs token vesting. Today's Solana vesting tools charge up to **~$11,700 in network rent** just to set up a 10,000-person airdrop with milestone vesting, before a single token moves. Six existing protocols (Streamflow, Zebec, Magna, Bonfida, Armada, Jito Distributor) each target a specific niche — individual payroll, investor vesting, option-based grants, or one-shot airdrops — but none offers affordable community-scale distribution combined with a full vesting platform and DeFi-composable positions.

---

# 6. How This Research Directly Shapes Week 2

**Authors:** Geral wrote the first 8 rows (3 vesting types → transaction atomicity), mapping Section 1 and Section 2 findings to Week 2 product decisions. Lana added the final 2 rows (Gap 1 → compressed distribution; Gap 2 → composable vesting positions) based on the Section 3–4 analysis.

This research isn't academic — every finding drives a specific product design decision in Week 2. Here's the direct translation from "what we learned" to "what we're building."

| **What We Learned (Week 1)** | **What We're Building (Week 2)** | **Why It Matters** |
|---|---|---|
| 3 vesting types are industry standard (cliff, linear, milestone) | Our product supports all 3 types from day one | No feature gap — we match competitors, then beat on cost |
| Cliff unlocks cause price shocks | Hybrid schedules: cliff + linear as default recommendation | Smoother market impact for clients' tokens |
| Linear streaming needs safe math (overflow risk with large numbers) | Using 128-bit intermediate calculations | No bugs, no lost tokens — reliability is a selling point |
| PDA vault security = no private key | All vaults use PDA-controlled token accounts | "Your tokens are in a keyless vault" — strong security pitch |
| CPI pattern for token transfers | Building the "claim" instruction using standard CPI flow | Battle-tested pattern — the same way all major Solana apps move tokens |
| Storage costs: ~$0.25 per vesting record | Accurate cost models for pricing decisions | We know our exact margins before writing a line of code |
| Cancellation needs clear rules | Configurable cancel policy per stream | "You control the terms — protection or flexibility, your choice" |
| Transactions are atomic (all-or-nothing) | Deposit + record creation in single transaction | Clients never face half-completed operations or lost funds |
| Setup costs price out community-scale launches (Gap 1) | Merkle-compressed distribution as core primitive | Matches Jito's cost efficiency while supporting full vesting types |
| Locked tokens sit as dead capital (Gap 2) | Vesting positions as composable DeFi primitives | Collateral use, DAO voting weight, transferability — differentiation layer |

---

# 7. Individual Developer Reports

**Authors:** Each developer wrote their own subsection independently — Geral wrote 7.1, Lana wrote 7.2.

## 7.1 Geral's Report

### 7.1.1 What I Researched This Week

I was responsible for the technical foundation track. I researched and documented two core areas:

**Token Distribution Types:** Deep-dive on cliff vesting, linear streaming, and milestone-based vesting. Includes real-world examples, logic explanations, and trade-off analysis for each type. This document translates those findings into BD/Marketing-friendly language.

**Solana Program Model:** Comprehensive documentation of how Solana stores data (accounts), secures vaults (PDAs), moves tokens between programs (CPIs), serializes data (Borsh), handles transactions (atomic model), and manages token custody (SPL Token + ATAs). All explained here without code for non-technical team members.

### 7.1.2 How We Split the Work

| **Area** | **Me (Geral)** | **Partner (Lana)** |
|---|---|---|
| Token distribution types (cliff, linear, milestone) | ✅ | |
| Solana program model (accounts, PDAs, CPIs) | ✅ | |
| How data is stored, programs interact, tokens held | ✅ | |
| Implementation logic & examples | ✅ | |
| Competitor analysis (Streamflow, Zebec, Magna) | | ✅ |
| Ecosystem gap identification | | ✅ |
| BD/Marketing summary | | ✅ |

### 7.1.3 Key Takeaways

- Cliff vesting is simple but creates market impact at unlock — when many investors unlock on the same date, token price can drop.
- Linear streaming is the safest release model but requires careful 128-bit math to prevent overflow bugs with large token amounts on Solana.
- Milestone-based vesting is the most flexible but introduces a trust question: who verifies that milestones are met? (time-based, authority-based, or oracle-based)
- Solana's account model means storage costs scale linearly with recipients — $0.35 per person. This is the root cause of the $3,500 problem for 10K users.
- PDA security is elegant: no private key exists for the vault, so only the vesting program can authorize transfers. Strong security with zero key management overhead.
- Solana's CPI depth limit (4 levels) will affect composability in future features like Vesting Vouchers — worth considering in architecture.

### 7.1.4 Blockers

- **Translating Technical Concepts:** Finding the right analogies to explain complex Solana concepts (like PDAs and CPIs) to the BD/Marketing team without losing technical accuracy.
- **Determining Abstraction Levels:** Deciding whether to document concepts from a native Solana perspective or through the Anchor framework lens to best prepare for Week 2 implementation.
- **Precise Rent Calculations:** Ensuring accurate byte-size calculations for data storage to avoid miscalculating rent-exemption fees, which heavily impacts the product's pricing model.
- **Need** to finalize team GitHub repository before Week 2 starts so we can begin coding.
- **Need** team decision on framework choice: Anchor framework vs native Solana program for Week 2 implementation.
- **Need** to align with BD teammates on their user interview findings to validate our gap analysis before starting protocol design.

### 7.1.5 How This Research Backs Week 2 Design

| **Research Finding** | **Week 2 Architecture Document Application** |
|---|---|
| PDA security & Account Space (Rent) calculations | **Account Structure Diagram:** Designing the exact byte layout for vesting records and PDA vault ownership. |
| Vesting types & CPI transfer patterns | **Program Instructions:** Defining exact parameters for create_stream, withdraw, and cancel instructions. |
| Transaction atomicity & Cross-program calls | **Data Flow Diagram:** Mapping the step-by-step token movement from depositor → PDA vault → beneficiary. |
| Framework abstraction levels (Anchor vs Native) | **Tech Stack Decision:** Providing technical reasoning for the framework choice in Week 2 implementation. |
| Integer overflow (u128 math), CPI limits, Rent risks | **Edge Cases Identification:** Forming the basis for identifying 5+ critical edge cases in the system design. |

---

## 7.2 Lana's Report

### 7.2.1 What I Built

- The six-protocol comparison table — 18 fields across cost, features, UX, and openness
- Gap identification (setup cost + locked-token liquidity) backed by the comparison data
- The BD/Marketing 1-paragraph product summary
- A deeper 15-protocol research pass (30 technical fields per protocol), written up in Section 9 (Appendix) below as supporting context

### 7.2.2 Work Split with Geral

| **Area** | **Lana** | **Geral** |
|---|---|---|
| Comparison table + gap identification + BD summary | ✅ | |
| 3 distribution types (cliff, linear, milestone) | | ✅ |
| Solana program model (accounts, PDAs, CPIs) | | ✅ |

### 7.2.3 Individual Blockers and Insights

- Multiple third-party write-ups quote vesting costs as "$3.51 for 10,000 users" — off by 1000×. All numbers recalculated from the Solana rent formula at verified SOL price.
- Earlier drafts described Bonfida as archived. Wrong — 154 commits, actively maintained, Kudelski-audited. Fixed everywhere.
- Earlier drafts cited jito-foundation/jito-governance (404) and said Jito had no compression. The actual repo is jito-foundation/distributor, which does use Merkle-based distribution with cliff + linear support.
- First pass used SOL at $150; recalculated at ~$85.
- Deep research hit API rate limits mid-batch; resolved by running remaining protocols sequentially.

### 7.2.4 How This Backs Week 2

- Comparison-table cost data establishes the economic baseline any new protocol must beat
- Gap 1 (setup costs) points at the primary design constraint for campaign architecture
- Gap 2 (locked-token composability) points at the secondary differentiation target
- The 15-protocol appendix (Section 9) is a living reference for later design decisions

---

# 8. Engineering Glossary — Terms You'll Hear From Engineering

**Author:** Geral — compiled the engineering-facing glossary (PDA, CPI, SPL Token, ATA, Rent, Anchor) to complement the non-technical glossary at the top of the document (Lana's).

When the dev team discusses the product, they'll use these terms. Here's what each one means in simple language:

| **Technical Term** | **Plain Language** | **Why You Should Care** |
|---|---|---|
| PDA (Program Derived Address) | A secure lockbox with no key — only the program can open it | Our security pitch: "No human holds the keys to the vault" |
| CPI (Cross-Program Invocation) | One program calling another — like a manager calling finance to process a payment | It's how we securely move tokens when a user claims |
| SPL Token | Solana's standard format for tokens (USDC, project tokens, etc.) | We support all standard Solana tokens — no custom integration needed |
| ATA (Associated Token Account) | A user's token "wallet" for a specific token — auto-created | Users don't need to do anything special to receive tokens |
| Rent | The storage fee Solana charges for keeping data on-chain | This is the cost that scales with users — the #1 problem we're solving |
| Anchor | A development framework for building Solana programs securely | We use industry-standard tools — professional and auditable |

---

# 9. Appendix — Deep Research across 15 Solana Protocols

**Author:** Lana — ran the deeper 15-protocol research pass (30 technical fields per protocol), wrote up the nine adjacent protocols, and mapped them back to the ecosystem rails captured in Section 3.

Alongside the six-protocol head-to-head in Section 3, I surveyed nine adjacent protocols that touch the vesting-and-distribution problem from different angles: compression infrastructure, DAO governance, multisig admin, token extensions, and DeFi integration. What follows is the plain-language version — everything a BD reader needs is below.

## 9.1 The Six Direct Competitors

The six protocols compared head-to-head in Section 3 — **Streamflow, Zebec Protocol, Magna, Bonfida Token Vesting, Armada, and Jito Distributor** — are the direct-competitor set. Their capabilities, costs, and limitations are fully documented in Section 3.

## 9.2 The Nine Adjacent Protocols

These are not direct vesting competitors. They're the surrounding ecosystem that any Solana vesting product operates alongside.

**1. Cardinal Protocol** *(2022, archived 2023)*
An open-source "token manager" that wrapped tokens with pluggable unlock conditions — you could attach rules like "unlocks on date X," "unlocks after N uses," or "unlocks when an admin signs." Architecturally the most flexible conditional-vesting design I found in the whole survey. The team pivoted in 2023 and the project is no longer maintained, but the code is still a useful reference for how conditional unlocks can be structured.

**2. Helius Compressed Airdrop API** *(2024, active)*
A hosted service (not a protocol) that lets teams send compressed airdrops to thousands of wallets via a web API. Uses Light Protocol (#3) under the hood. Pricing: free tier for small scale, $99/month for developers, $499/month for business. Easiest commercial on-ramp to cheap mass distribution on Solana, but it only does one-shot airdrops — no vesting schedules, no milestone support.

**3. Light Protocol / ZK Compression** *(2024, active)*
Infrastructure that stores account data off-chain while keeping a short cryptographic proof on-chain that the data is valid. A project can host ~1 million token accounts for roughly the cost of 10 regular ones. Light Protocol is the raw primitive; products like Helius are built on top. No fees beyond Solana's standard network fees.

**4. Marinade & Kamino** *(2021, active — included as DeFi reference, not as vesting tools)*
Not vesting protocols. **Marinade** is Solana's biggest liquid-staking provider: users lock SOL, receive mSOL in return, and can use mSOL across DeFi (lending, trading) while the underlying SOL earns staking rewards. **Kamino** is a top Solana lending market (~$1B TVL in 2024). Surveyed both as reference models for how "locked but still usable" assets are designed on Solana.

**5. Metaplex Bubblegum** *(2022, active)*
Solana's standard for compressed NFTs (cNFTs). Hundreds of millions of cNFTs have been minted through it — the most battle-tested compression technology on Solana in live production. Uses Merkle trees, same broad family as Jito's distributor, tuned for NFTs. Small per-mint protocol fee paid in SOL.

**6. Realms / SPL Governance** *(2021, active)*
Solana's standard DAO platform: voting, proposals, multi-asset treasury management. Includes an add-on called the Voter Stake Registry that can assign voting weight to locked tokens — meaning in principle, a vesting recipient could vote in a DAO using tokens they haven't unlocked yet. Free to use (only Solana rent and network fees). This is the integration point for any vesting protocol that wants DAO features.

**7. SPL Token-2022** *(2023, active)*
The newer version of Solana's standard token program. Adds "extensions" that the original SPL Token program doesn't have: transfer hooks (run code on every transfer), transfer fees, non-transferability flags, on-chain metadata, interest-bearing balances, and more. Steadily becoming the default for new Solana token launches. Fee model depends on which extensions a project enables.

**8. Squads Protocol v4** *(2024, active)*
Solana's leading multi-signature standard. Treasury-class teams use Squads multisigs to control >$1B in assets across the Solana ecosystem (2024 estimate). Free for basic multisig; paid subscription for advanced features. Most enterprise-grade admin controls on Solana run through Squads.

**9. cNFT Vesting Vouchers** *(2024, emerging community pattern)*
Not a single protocol — a pattern several independent teams have prototyped in 2024 where each recipient's vesting position is represented as a compressed NFT (cNFT) built on Metaplex Bubblegum. The cNFT can be transferred between wallets or referenced by other DeFi programs. No standardized implementation exists yet; all current work is in prototype or proof-of-concept stage.

## 9.3 Why the Nine Adjacent Protocols Matter to This Research

Together they describe the infrastructure around vesting on Solana:

- **Compression infrastructure** (Bubblegum, Light Protocol, Helius) is production-ready and widely adopted — primarily for NFTs and one-shot airdrops today.
- **DAO governance tooling** (Realms / SPL Governance) already has the plumbing for weighting locked tokens in votes.
- **Liquid-locked-asset designs** (Marinade, Kamino) show how Solana DeFi handles assets that are locked but still composable.
- **Multisig standards** (Squads v4) are the baseline admin-control layer for any program holding material treasury value.
- **Modern token primitives** (SPL Token-2022) are the current default for new token launches.

These are the ecosystem rails that any Solana distribution product operates alongside. Their presence (or absence) in the competitors from Section 3 is part of what the comparison table captures.

---

# References

**Authors:** References are split by author. Lana's list covers the comparison/gap/BD work (Sections 3–5) and the 15-protocol appendix (Section 9). Geral's list covers the token vesting types and Solana program model work (Sections 1–2).

## Lana's Research References (Comparison, Gaps, BD Summary)

- SOL price — CoinMarketCap, 2026-04-19: [https://coinmarketcap.com/currencies/solana/](https://coinmarketcap.com/currencies/solana/)
- Solana rent formula — rent = (data_size_bytes + 128) × 3,480 lamports/byte × 2 years: [https://docs.solana.com/developing/programming-model/accounts#rent](https://docs.solana.com/developing/programming-model/accounts#rent)
- Streamflow — [https://github.com/streamflow-finance/timelock-crate](https://github.com/streamflow-finance/timelock-crate). Halborn + OtterSec audits (2022). Fee: 0.25–0.5% per withdrawal. Accessed 2026-04-19.
- Zebec Protocol — [https://github.com/Zebec-Protocol](https://github.com/Zebec-Protocol). Sec3 + OtterSec per community reports. Fee model not disclosed. Accessed 2026-04-19.
- Magna — [https://magna.so](https://magna.so). Closed source, no public audit. B2B SaaS. Accessed 2026-04-19.
- Bonfida Token Vesting — [https://github.com/Bonfida/token-vesting](https://github.com/Bonfida/token-vesting). 154 commits, actively maintained. Kudelski audit in /audit folder. Accessed 2026-04-19.
- Armada (Dual Finance) — [https://github.com/Dual-Finance](https://github.com/Dual-Finance). Core audited by Sec3 (2022–23); launch-pool code unaudited. Accessed 2026-04-19.
- Jito Distributor — [https://github.com/jito-foundation/distributor](https://github.com/jito-foundation/distributor). Merkle-based with cliff + linear vesting. No protocol fee. Accessed 2026-04-19.
- Cardinal Protocol — [https://github.com/cardinal-labs](https://github.com/cardinal-labs) (archived). Conditional token manager with pluggable unlock invalidators. Accessed 2026-04-19.
- Helius Compressed Airdrop API — [https://www.helius.dev/](https://www.helius.dev/) (compressed airdrop docs). Subscription tiers: free / $99 / $499 / enterprise. Accessed 2026-04-19.
- Light Protocol / ZK Compression — [https://github.com/Lightprotocol/light-protocol](https://github.com/Lightprotocol/light-protocol). Concurrent Merkle trees for compressed account state. Accessed 2026-04-19.
- Marinade Finance — [https://github.com/marinade-finance](https://github.com/marinade-finance). Liquid staking; ~$400M–$600M TVL. Accessed 2026-04-19.
- Kamino Finance — [https://github.com/Kamino-Finance](https://github.com/Kamino-Finance). Lending market; ~$1B+ TVL (2024). Accessed 2026-04-19.
- Metaplex Bubblegum — [https://github.com/metaplex-foundation/mpl-bubblegum](https://github.com/metaplex-foundation/mpl-bubblegum). cNFT standard on Solana; hundreds of millions minted. Accessed 2026-04-19.
- Realms / SPL Governance — [https://github.com/solana-labs/solana-program-library/tree/master/governance](https://github.com/solana-labs/solana-program-library/tree/master/governance). Solana DAO standard. Voter Stake Registry add-on supports locked-token voting weight. Accessed 2026-04-19.
- SPL Token-2022 — [https://github.com/solana-labs/solana-program-library/tree/master/token/program-2022](https://github.com/solana-labs/solana-program-library/tree/master/token/program-2022). Extensions: transfer hooks, metadata, non-transferability, transfer fees. Accessed 2026-04-19.
- Squads Protocol v4 — [https://github.com/Squads-Protocol/v4](https://github.com/Squads-Protocol/v4). Multi-sig standard; >$1B controlled via Squads multisigs (2024). Accessed 2026-04-19.
- cNFT Vesting Vouchers — emerging community pattern layered on Metaplex Bubblegum (ref #14). No standardized implementation yet; multiple independent 2024 prototypes. Accessed 2026-04-19.

---

## Geral's Research References (Distribution Types, Solana Program Model)

The following sources were used during the research phase of this document. All links were verified as of April 2026.

### Solana Core Documentation

- **Solana Official Documentation — Overview**
  [https://docs.solana.com](https://docs.solana.com)
  *Core reference for understanding the Solana runtime, account model, and transaction processing.*

- **Solana — Accounts & Data Storage**
  [https://docs.solana.com/developing/programming-model/accounts](https://docs.solana.com/developing/programming-model/accounts)
  *How accounts store state on Solana, ownership rules, and rent-exemption mechanics.*

- **Solana — Program Derived Addresses (PDAs)**
  [https://docs.solana.com/developing/programming-model/calling-between-programs#program-derived-addresses](https://docs.solana.com/developing/programming-model/calling-between-programs#program-derived-addresses)
  *How PDAs are derived from seeds + program ID, bump mechanics, and why PDAs have no private key.*

- **Solana — Cross-Program Invocations (CPIs)**
  [https://docs.solana.com/developing/programming-model/calling-between-programs](https://docs.solana.com/developing/programming-model/calling-between-programs)
  *How programs call other programs, invoke_signed for PDA authority, CPI depth limits.*

- **Solana — Rent & Storage Economics**
  [https://docs.solana.com/developing/intro/rent](https://docs.solana.com/developing/intro/rent)
  *Rent-exemption thresholds, cost per byte, and how rent scales with account size.*

- **Solana — Transaction Processing**
  [https://docs.solana.com/developing/programming-model/transactions](https://docs.solana.com/developing/programming-model/transactions)
  *Atomic transaction model, instruction format, and all-or-nothing execution guarantees.*

### Anchor Framework

- **Anchor Official Documentation**
  [https://www.anchor-lang.com/docs](https://www.anchor-lang.com/docs)
  *Framework used for Solana program development — account constraints, PDA derivation, CPI helpers.*

- **Anchor — Account Constraints & Space Calculation**
  [https://www.anchor-lang.com/docs/account-constraints](https://www.anchor-lang.com/docs/account-constraints)
  *How Anchor calculates account sizes, discriminators (8-byte type tags), and init macros.*

- **Anchor GitHub Repository**
  [https://github.com/coral-xyz/anchor](https://github.com/coral-xyz/anchor)
  *Source code and examples for the Anchor framework.*

### SPL Token Program

- **SPL Token Documentation**
  [https://spl.solana.com/token](https://spl.solana.com/token)
  *Standard token program for Solana — mint, transfer, ATA (Associated Token Account) mechanics.*

- **SPL Token-2022 (Token Extensions)**
  [https://spl.solana.com/token-2022](https://spl.solana.com/token-2022)
  *Next-generation token standard with metadata extensions — relevant for Vesting Voucher design (Phase 2).*

- **SPL Associated Token Account**
  [https://spl.solana.com/associated-token-account](https://spl.solana.com/associated-token-account)
  *How ATAs are derived deterministically from (wallet + mint) — used in vesting claim flow.*

### Token Vesting — Industry References

- **Investopedia — What Is Vesting?**
  [https://www.investopedia.com/terms/v/vesting.asp](https://www.investopedia.com/terms/v/vesting.asp)
  *General explanation of vesting schedules, cliff vesting, and graded vesting from traditional finance.*

- **a16z Crypto — Token Distribution Best Practices**
  [https://a16zcrypto.com/posts/article/token-launch-and-distribution-best-practices/](https://a16zcrypto.com/posts/article/token-launch-and-distribution-best-practices/)
  *Andreessen Horowitz's guide on token distribution strategies, lockups, and vesting design.*

- **Messari — Token Unlock Schedules**
  [https://messari.io/research/token-unlocks](https://messari.io/research/token-unlocks)
  *Industry data on how token unlock events affect market prices — supports cliff vs. linear analysis.*

- **CoinGecko — Understanding Token Vesting Schedules**
  [https://www.coingecko.com/learn/what-is-token-vesting](https://www.coingecko.com/learn/what-is-token-vesting)
  *Beginner-friendly overview of cliff, linear, and milestone-based vesting with visual examples.*

### Existing Vesting Protocols on Solana (GitHub)

- **Streamflow Finance — Token Vesting Protocol**
  [https://github.com/streamflow-finance/js-sdk](https://github.com/streamflow-finance/js-sdk)
  *Most widely used Solana vesting solution. Referenced for stream account architecture and release formula.*

- **Zebec Protocol — Streaming Payments**
  [https://github.com/ArslanHaaworkedAt/zebec-protocol](https://github.com/ArslanHaaworkedAt/zebec-protocol)
  *Milestone-based vesting reference. Studied for per-milestone PDA design and pause/resume functionality.*

- **Bonfida Token Vesting (Open Source)**
  [https://github.com/Bonfida/token-vesting](https://github.com/Bonfida/token-vesting)
  *Early open-source Solana vesting implementation. Referenced for basic vesting contract patterns.*

- **Solana Token Vesting — Search Results**
  [https://github.com/search?q=solana+token+vesting&type=repositories](https://github.com/search?q=solana+token+vesting&type=repositories)
  *GitHub search for additional Solana vesting implementations and patterns.*