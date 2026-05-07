# Geral — Week 3 Tasks

## Why this exists

Lana already shipped the Anchor skeleton, account structs, smoke test, README, and CI in
`mancer-vesting/`. What's left is **Week 3 acceptance criterion #7** — the partner-build
verification — which only you can fulfill. Doing it well also satisfies the Week 3 KPI
("Dev partner can clone, follow README, and have it running in under 15 minutes. CI is green.")
for both of us. Submission deadline: **2026-05-09**.

This is intentionally scoped tight so you have visible commits and a merged PR on the
record before the deadline. Reviewers score each dev individually on commits + PRs + report.

---

## Step 0 — Access (do first)

- Confirm you have push access to `Ah-Riz/mancerxsuperteam-token-vesting`.
- If not, ping Lana to add you. Nothing below works until this is done.

---

## Step 1 — Clone and follow the README from zero, timed

On your machine, in a clean directory you'll throw away after:

1. Start a stopwatch.
2. `git clone https://github.com/Ah-Riz/mancerxsuperteam-token-vesting.git && cd mancerxsuperteam-token-vesting`
3. Follow `README.md` top to bottom, exactly as written. Don't skip steps. Don't fill in your own knowledge — if a step is unclear, that's a README bug, write it down.
4. Targets to hit:
   - `anchor build` finishes with no errors.
   - `anchor test` finishes with the smoke test passing.
   - Devnet deploy section completes and prints a program ID.
5. Stop the stopwatch when devnet deploy succeeds. Record the elapsed time.
6. Screenshots to capture:
   - `anchor test` output showing the test pass.
   - Devnet deploy output showing the program ID.
   - Any error you hit (paste the full terminal block).

Two outcomes:
- **Under 15 minutes, no friction**: KPI met. Go to Step 2's zero-friction path.
- **Over 15 minutes or anything broke**: every friction point becomes a README fix in Step 2. This is *better* for your grade — more commits, clearer collaboration evidence.

---

## Step 2 — Open a PR with README fixes

Branch:

```
git checkout -b dev_geral
```

Likely friction points to watch for as you go through Step 1 (fix in README if you hit them):

- Node version pin missing or wrong (CI uses Node 20; README should say `Node >= 20.10`).
- Solana CLI / Anchor CLI version mismatch (Anchor 1.0.0 via `avm`, Solana >= 2.1).
- `pnpm install` step missing or ordered wrong relative to `anchor build`.
- Devnet airdrop / keypair generation not spelled out (e.g. `solana-keygen new`, `solana airdrop 2 --url devnet`).
- `Anchor.toml` program ID not matching the one declared in `programs/vesting/src/lib.rs`.
- `anchor test` requires a local validator state that wasn't set up.
- pnpm workspace step missing for `apps/*` and `clients/*`.

For each thing you fix, one small commit:

```
git commit -m "docs(readme): pin Node >= 20.10 in prerequisites"
git commit -m "docs(readme): add solana-keygen + airdrop step before devnet deploy"
```

Then push and open a PR titled `docs(readme): partner-build verification (Week 3 AC #7)`.
PR body should include:

- Build time you measured.
- The screenshots from Step 1.
- A bullet list of every fix in the PR.
- A line: "Verified Week 3 acceptance criterion #7."

CI must be green on the PR before merging. If it isn't, ping Lana — that's also a Week 3
deliverable.

### Zero-friction path (if you hit nothing)

You still need at least one commit on the record. Ship:

1. `docs/screenshots/anchor-test.png` and `docs/screenshots/devnet-deploy.png` from Step 1.
2. README edit at the top:

```
> Build verified by @geral on 2026-05-0X. Clone-to-devnet-deploy in N minutes.
> See `docs/screenshots/` for evidence.
```

Same PR title, same "Verified Week 3 acceptance criterion #7" line in the body.

---

## Step 3 — Your weekly report

Honest, mapped to your visible commits/PRs. Template:

- **What I built this week**: Executed the partner-build verification for the Week 3 foundation.
  Cloned from zero, built and deployed to devnet in **N minutes**. CI green on PR #X. Surfaced
  and fixed the following README gaps: [list]. (Or, zero-friction: confirmed the README is
  followable end-to-end and added build-verification evidence under `docs/screenshots/`.)
- **How we split the work**: Lana owned acceptance criteria 1–6 (project init, instruction
  stubs, account structs, README, smoke test, CI). I owned criterion 7 (partner verification)
  and the README fixes that came out of it.
- **Blockers / insights**: [whatever you actually hit].

---

## Out of scope this week

Do not touch in Week 3 — these are Week 4+ work and would just delay you:

- `apps/web/` scaffolding (frontend stack pick is yours, but save it for Week 4).
- `clients/ts/` Merkle tooling (joint, needs coordination).
- `programs/vesting/src/**` (Lana's track).
- `CONTRIBUTING.md`, PR/issue templates, dev-experience polish.

---

## Definition of done

- [ ] You have push access on the working repo.
- [ ] You followed the README from zero on your machine and recorded a build time.
- [ ] At least one commit on `dev_geral` authored by your git email.
- [ ] One PR opened, CI green, merged into the working branch.
- [ ] Your weekly report names the PR and the build time and explicitly cites acceptance
      criterion #7.
