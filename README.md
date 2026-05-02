# Mancer Vesting

Solana token-distribution protocol combining Merkle-tree compression with full vesting (cliff / linear / milestone), per-recipient clawback via root rotation, and a 7-day campaign-wide grace clawback.

Built by Team 7 (Mancer x Superteam Scholarship).

## Repo layout

```
mancer-vesting/
├── programs/vesting/   # Anchor program (Rust)              — owner: Lana
├── clients/ts/         # Off-chain Merkle tooling (TS)      — owner: Lana
├── apps/web/           # Frontend dApp                       — owner: Geral
├── Anchor.toml         # Anchor workspace
├── Cargo.toml          # Rust workspace
├── package.json        # pnpm workspaces root
└── pnpm-workspace.yaml
```

## Ownership

| Area                | Owner | Notes                                       |
| ------------------- | ----- | ------------------------------------------- |
| `programs/vesting/` | Lana  | Anchor program, instructions, state, math   |
| `clients/ts/`       | Lana  | Leaf encoder, Merkle builder, proof helpers |
| `apps/web/`         | Geral | Frontend stack, wallet adapter, UX          |
| Root configs, CI    | Joint | Workspace files, GitHub Actions             |

## Prerequisites

- Rust stable (edition 2021)
- Solana CLI ≥ 2.1
- Anchor CLI 1.0.0 — install with `avm install 1.0.0 && avm use 1.0.0`
- Node ≥ 20
- pnpm ≥ 10 (`npm i -g pnpm`)

## Quickstart

```bash
git clone https://github.com/Ah-Riz/mancerxsuperteam-token-vesting.git
cd mancerxsuperteam-token-vesting

pnpm install
anchor build
anchor test
```

## Build spec

The full backend build brief (instructions, account layouts, math primitives, test scenarios) lives in `../week3/OPENCLAW_BRIEF.md` in the parent research repo.

## License

MIT — see `LICENSE`.
