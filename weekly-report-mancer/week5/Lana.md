# Weekly Report — Lana (Week 5)

## What I built this week

**BE-SC Merkle pipeline verified end-to-end: 3-leaf campaigns (Cliff/Linear/Milestone) flow through prepare -> POST -> GET proof -> verify against deployed API. RLS enabled on all Supabase tables. Deployed at velthoryn.vercel.app.**

### BE-SC Merkle Pipeline — 6 phases completed

Phase 1 — Merkle Builder Parity:
- `scripts/test-merkle-parity.ts` validates `clients/ts/src/merkle.ts` and `apps/web/src/lib/merkle/builder.ts` produce byte-identical roots and proofs
- 13 parity checks: roots match, proofs for 3 leaves (Cliff/Linear/Milestone) match, cross-verification passes
- Both implementations: even index hashes `(current, sibling)`, odd index hashes `(sibling, current)`, odd-length layers duplicate last node

Phase 2 — DB Schema Sync:
- Drizzle ORM schema synced to Supabase PostgreSQL
- 4 tables: `campaigns` (16 cols), `root_versions` (7 cols), `leaves` (11 cols), `claim_events` (11 cols)
- Indexes verified: `uq_creator_mint_campaign`, `uq_campaign_version`, `uq_root_version_leaf`, all `idx_*` indexes present

Phase 3 — E2E Merkle Pipeline Test:
- `scripts/test-be-merkle-pipeline.ts` validates: prepareCampaign -> POST /api/campaigns -> GET proof x3 -> verifyProof x3
- 3 recipients: Cliff, Linear, Milestone release types
- All proofs verify against the merkle root, leaf data matches input

Phase 4 — Build Fix & Local Verification:
- `apps/web/` builds cleanly with `pnpm build`
- 74/74 SC tests pass (up from 63 in Week 4 — added 11 new stream tests)
- `.env.example` created with all required env vars

Phase 5 — Vercel Deployment:
- Deployed at velthoryn.vercel.app
- All 8 API routes responding correctly
- 4 curl smoke tests pass (list campaigns empty, 404 nonexistent, 400 missing param, empty beneficiary)

Phase 6 — Post-Deploy E2E:
- `test-be-merkle-pipeline.ts` hardened with `--url` flag, `--timeout` flag (default 15s), `fetchWithTimeout` with AbortController, GET /api/campaigns smoke test, formatted summary table output
- Phase 6 gate passed locally: ALL PASS (prepare, POST 201, GET campaigns, GET proofs 3/3, verifyProof 3/3)

### Security Hardening

- RLS enabled on all 4 Supabase tables with read-public / write-service-role policies
- Proof verification bypass fixed in `campaigns/route.ts`: multi-leaf trees with empty first-leaf proof now reject with 400
- leafCount vs leaves.length mismatch check added
- Supabase security advisors: 0 lints

### CI Pipeline

- New `.github/workflows/web-ci.yml` with 3 parallel jobs: merkle-parity, e2e-pipeline (Postgres container + dev server), web-build-test (Vitest + build)
- Uses `postgres:15` service container with health checks, `127.0.0.1` for DATABASE_URL

### Infrastructure

- DB pool config: `max: 3`, `connect_timeout: 30` for Supabase pooler latency
- `apps/web/.env` symlinked to `../../.env`

---

## Status — What works and what doesn't

### Working

| Item | Evidence |
|---|---|
| Merkle builder parity (TS SDK vs FE builder) | 13/13 checks pass in `test-merkle-parity.ts` |
| DB schema synced to Supabase | 4 tables, all indexes verified |
| E2E Merkle pipeline test | 5/5 phases pass locally |
| Vercel deployment | velthoryn.vercel.app live, all 8 API routes responding |
| Post-deploy E2E | ALL PASS: prepare, POST 201, GET campaigns, GET proofs 3/3, verifyProof 3/3 |
| RLS on all Supabase tables | 9 policies (4 SELECT, 5 INSERT/UPDATE/DELETE), 0 security lints |
| Proof verification bypass fixed | Multi-leaf empty-first-leaf proof rejected with 400 |
| `apps/web/` builds cleanly | `pnpm build` exits 0 |
| 74/74 SC tests pass | Up from 63 in Week 4 — 11 new stream tests |
| 208/208 FE tests pass | All Vitest tests green |
| Web CI workflow | 3 parallel jobs: merkle-parity, e2e-pipeline, web-build-test |

### Issues found and fixed this week

| Issue | Severity | Root cause | Fix |
|---|---|---|---|
| RLS disabled on all 4 Supabase tables | Critical | Tables were created via `drizzle-kit push` without RLS policies. Anyone with the anon key could read/write all rows. | Migration applied: RLS enabled, 9 policies created (read-public, write-service-role). |
| Proof verification bypass in POST /api/campaigns | Critical | Multi-leaf trees where the first leaf had an empty proof array (`proof.length === 0`) skipped verification entirely. An attacker could submit a fraudulent root with no valid proofs. | Changed `else if (firstLeaf.proof.length > 0)` to `else` with an explicit rejection for empty proofs on multi-leaf campaigns. |
| leafCount not cross-checked against leaves array | High | `data.leafCount` from the client was trusted without validating it matched `data.leaves.length`. Could store incorrect metadata. | Added explicit check: `leafCount !== leaves.length` returns 400. |
| `apps/web/` had no `.env` file | Medium | Next.js only loads `.env` from the project root (`apps/web/`), not the monorepo root. Dev server ran without `DATABASE_URL`, causing `ECONNREFUSED` on every API call. Debugging this took ~20 min. | Symlinked `apps/web/.env -> ../../.env`. |
| Supabase pooler latency (15-30s per query) | Medium | `aws-1-ap-southeast-1.pooler.supabase.com:6543` (transaction-mode pooler) is slow from our region. E2E test POST took 29-60s per request, causing test timeouts. | Increased `connect_timeout: 30`, `max: 3` pool, and E2E test `--timeout 120000`. |
| `Number()` truncation on u64 columns | Medium (deferred) | Drizzle schema uses `{ mode: "number" }` for `amount`, `totalSupply`, `startTime`, etc. Values above `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991) silently truncate. Safe for devnet token amounts, but will corrupt data for large mainnet supplies. | Known issue, deferred. Fix: migrate to `{ mode: "string" }` before mainnet. |
| SSL cert verification disabled | Low | `rejectUnauthorized: false` in the DB connection config bypasses certificate validation, vulnerable to MITM in production. | Known issue, deferred. Acceptable for devnet; must fix for mainnet (use proper CA chain). |

---

## Blockers — What's stuck or what you need

**No active blockers.** All 6 pipeline phases passed their gates and the deployment is live.

**Deferred items (not blockers, but must fix before mainnet):**
1. **`Number()` truncation on u64 columns** — Drizzle schema uses `{ mode: "number" }` for `amount`, `totalSupply`, timestamps. Must migrate to `{ mode: "string" }` before mainnet to prevent silent data corruption on large token amounts.
2. **SSL `rejectUnauthorized: false`** — Database connection skips certificate validation. Must use proper CA chain for production.
3. **Only first leaf proof verified server-side** — POST /api/campaigns verifies only `leaves[0]`. Leaves 1..N are stored without proof verification. An attacker could submit valid first leaf + fraudulent siblings. Mitigated by the merkle root being verifiable on-chain, but should verify all leaves server-side for defense-in-depth.

---

## Metrics — Quantifiable progress

| Metric | Value |
|---|---|
| SC tests | 74/74 (was 63/63) |
| FE tests | 208/208 |
| Merkle parity checks | 13/13 |
| E2E pipeline phases | 5/5 pass |
| CI workflows | 3 (ci.yml, lint.yml, web-ci.yml) |
| Supabase security lints | 0 |
| RLS policies | 9 (4 SELECT, 5 INSERT/UPDATE/DELETE) |
| API routes deployed | 8 at velthoryn.vercel.app |
| DB tables | 4 (campaigns, root_versions, leaves, claim_events) |
| Curl smoke tests | 4/4 pass |
| Week 4 -> Week 5 delta | 63 -> 74 SC tests, 0 -> 13 parity checks, 0 -> E2E pipeline verified, 0 -> deployed API, 2 -> 3 CI workflows, RLS enabled |
