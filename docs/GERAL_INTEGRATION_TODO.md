# Geral Integration TODO — Week 6 Final Push

> **Generated:** 2026-05-27  
> **Last Updated:** 2026-05-28  
> **Branch:** `dev_geral` (28 commits ahead of `dev_lana`)  
> **Purpose:** Track all changes Geral has implemented beyond Lana's base, plus remaining work needed.

---

## What's Already Done (Geral on top of Lana)

All of Lana's commits are merged into `dev_geral`. The following are Geral-only additions:

### Smart Contract (3 new native SOL instructions + hardening)

| Change | Files | Status |
|--------|-------|--------|
| `create_campaign_native` instruction | `create_campaign.rs`, `lib.rs` | ✅ Done |
| `create_stream_native` instruction | `create_stream.rs`, `lib.rs` | ✅ Done |
| `fund_campaign_native` instruction | `fund_campaign.rs`, `lib.rs` | ✅ Done |
| `cancel_campaign` clears paused on cancel (exploit fix) | `cancel_campaign.rs` | ✅ Done |
| `cancel_stream` dual-path (SPL + native SOL) with Optional accounts | `cancel_stream.rs` | ✅ Done |
| `claim` updated account order + native SOL path | `claim.rs` | ✅ Done |
| `withdraw` + `withdraw_unvested` native SOL support | `withdraw.rs`, `withdraw_unvested.rs` | ✅ Done |
| 3 new error variants: `NativeSolVaultNotEmpty`, `NativeSolRentViolation`, `UnsupportedMint` | `errors.rs` | ✅ Done |
| 12 native SOL vesting tests | `vesting-native-sol.spec.ts` | ✅ Done |
| Security exploit test (EXPLOIT 12: pause→cancel→claim grace) | `security.spec.ts` | ✅ Done |
| Clock-based vesting tests | `vesting.clock.spec.ts` | ✅ Done |
| Supplementary vesting tests | `vesting.supplementary.spec.ts` | ✅ Done |

### Backend / API

| Change | Files | Status |
|--------|-------|--------|
| `withRoute()` wrapper (admin, auth, rate-limit, body-limit) | `route-wrapper.ts` | ✅ Done |
| Admin sync uses `indexAllEvents()` (all event types) | `admin/sync/route.ts` | ✅ Done |
| Auth nonce route (wallet auth) | `auth/nonce/route.ts` | ✅ Done |
| `event-indexer.ts` — unified indexer for all 10+ event types | `indexer/event-indexer.ts` | ✅ Done |
| `state-sync.ts` — on-chain state sync | `indexer/state-sync.ts` | ✅ Done |
| `claim-events.ts` — sync checkpoint persistence | `indexer/claim-events.ts` | ✅ Done |
| Auth gate removed from `POST /api/campaigns` (unblock indexing) | `campaigns/route.ts` | ✅ Done |
| Error handler + request-id middleware | `api/errors.ts`, `api/request-id.ts` | ✅ Done |
| Rate limiting | `api/rate-limit.ts` | ✅ Done |
| Body size limit | `api/body-limit.ts` | ✅ Done |
| JSON response helper | `api/json-response.ts` | ✅ Done |

### Database / Schema

| Change | Files | Status |
|--------|-------|--------|
| 6 new event tables in Drizzle schema | `schema.ts` | ✅ Done |
| `cancel_events` table | migration `0004` | ✅ Done |
| `pause_events` table | migration `0004` | ✅ Done |
| `root_update_events` table | migration `0004` | ✅ Done |
| `withdraw_events` table | migration `0004` | ✅ Done |
| `milestone_events` table | migration `0004` | ✅ Done |
| `stream_cancel_events` table | migration `0004` | ✅ Done |
| `sync_state` table (indexer checkpoint) | migration `0003` | ✅ Done |
| `waitlist` table with RLS | migration `0003` | ✅ Done |
| RLS policies on all tables | migration `0003` | ✅ Done |
| Timeline indexes | migration `0005` | ✅ Done |

### Frontend Hooks

| Change | Files | Status |
|--------|-------|--------|
| `useCreateCampaign` — native SOL + auto-wrap + `createAndFundCampaign` | `useCreateCampaign.ts` | ✅ Done |
| `useCreateStream` — native SOL + auto-wrap path | `useCreateStream.ts` | ✅ Done |
| `useWrapSol` — partial unwrap, rate-limit guard, balance dedup | `useWrapSol.ts` | ✅ Done |
| `useLocalCampaigns` — batched fetching, retry tuning | `useLocalCampaigns.ts` | ✅ Done |
| `useProofLookup` — 404 returns null instead of throwing | `useProofLookup.ts` | ✅ Done |
| `useCampaignDetail` — recipients array, hasMilestoneLeaves | `useCampaignDetail.ts` | ✅ Done |

### Frontend Pages / Components

| Change | Status |
|--------|--------|
| Allocations page (root rotation card) | ✅ Done |
| Landing page polish (messaging + nav) | ✅ Done |
| Sidebar hydration fix | ✅ Done |
| Error formatting (account not found, insufficient lamports, wallet rejection) | ✅ Done |
| Sentry integration | ✅ Done |
| Vercel Web Analytics | ✅ Done |
| CSP + security headers | ✅ Done |

### Docs / Roadmap

| Change | Status |
|--------|--------|
| 6-phase roadmap (phases 00–05) | ✅ Done |
| Security audit doc | ✅ Done |
| Gap analysis (EN + ID) | ✅ Done |
| End-user guide | ✅ Done |

---

## Current Status

### P0 — Critical (Must Fix Before Submission)

| # | Issue | Detail | Owner |
|---|-------|--------|-------|
| P0-1 | **Claim DB update not persisting** | ✅ Fixed. Claim success now triggers claim sync/indexer retry, updates DB, invalidates campaign/beneficiary caches, and tolerates native SOL final-drain account fetch fallback. Verified with real claim flows. | Geral |
| P0-2 | **IDL drift — devnet vs local** | ✅ Fixed / practically cleared. Remote IDL now matches local instruction surface, and native SOL create/claim paths are verified. Manual instruction builders remain only as devnet compatibility hardening. | Joint |
| P0-3 | **Campaign status not updating after claim** | ✅ Fixed. Campaign list/detail reflect post-claim state through sync + cache invalidation + DB idempotent updates. | Geral |

### P1 — High Priority (Should Fix)

| # | Issue | Detail | Owner |
|---|-------|--------|-------|
| P1-1 | **E2E test checklist** | 🟡 Manual coverage mostly complete: cliff, linear, native SOL create/claim, bulk milestone, pause/cancel, claim DB sync. Remaining: update formal checklist/docs and run final pass after Lana cancel-design decision. | Geral |
| P1-2 | **Playwright E2E wired** | 🟡 Wired with 4 smoke tests (`landing`, cliff/linear/milestone create pages disconnected state). Local execution is blocked by missing OS browser dependency (`libnspr4.so`); `test:e2e:deps` documents the fix. | Geral |
| P1-3 | **Web test reproducibility** | ✅ Improved. Added DB-free `test:unit` config/script (231 tests pass without Postgres), explicit `test:db` alias for DB suite, remote DB write guard, and docs for local Postgres. | Geral |
| P1-4 | **Milestone manual UX** | ✅ Fixed. Manual milestone with >1 milestone now creates one bulk campaign. Duplicate beneficiary behavior confirmed: milestone supports same beneficiary with unique `milestoneIdx`; cliff/linear same beneficiary remains blocked due SC claim-record model. Cancel UX/design for multi-leaf remains pending Lana decision. | Joint |
| P1-5 | **Native SOL claim path integration** | ✅ Fixed and verified. Native SOL claim path supports lamport vault flow; final claim drain/rent behavior documented in testing notes. | Geral |
| P1-6 | **Lint warnings cleanup** | ✅ Fixed. `pnpm --dir apps/web lint` passes. | Geral |

### Additional Fixes Completed During E2E

| Area | Detail | Status |
|------|--------|--------|
| Campaign create indexing | `POST /api/campaigns` made idempotent to avoid duplicate campaign unique constraint failures. | ✅ Done |
| Funding recovery | Create/fund split now stores pending unfunded campaigns; create pages and campaign detail can resume funding. Claim buttons are disabled while underfunded. | ✅ Done |
| CSV validation | Bulk CSV now enforces expected `releaseType` per page: cliff page only cliff, linear only linear, milestone only milestone. | ✅ Done |
| Web test reproducibility | Added `vitest.unit.config.ts`, `test:unit`, `test:db`, and `test:e2e:deps`; documented local DB and Playwright OS dependency setup. | ✅ Done |
| Pending funding display | Pending funding amounts display UI token amount (`0.003 SOL`) instead of raw lamports. | ✅ Done |
| Cancel/pause status | Cancelled campaigns cannot be paused; status API clears `paused` when cancelled. | ✅ Done |
| Cancel settle UI/DB | `cancelStream` instant settle updates UI claim state and DB `totalClaimed`; avoids stale claim button after native SOL final drain. | ✅ Done |
| Vesting chart | Guarded chart math against `NaN` SVG line attributes on edge schedule/cancel states. | ✅ Done |

### P2 — Medium Priority (Nice to Have)

| # | Issue | Detail | Owner |
|---|-------|--------|-------|
| P2-1 | **IPFS/Pinata pinning not live** | `ipfsCid` field exists but no actual pinning flow. Docs should say "metadata ready, pinning not implemented". | Geral |
| P2-2 | **Event tables — verify migration ran on Supabase** | 6 event tables defined in schema + migrations but need to confirm they exist in production Supabase. | Joint |
| P2-3 | **Indexer cron schedule** | Vercel cron set to once/day (hobby plan limit). May need manual sync trigger for demo. | Geral |
| P2-4 | **Docs sync** | Multiple docs still reference old state. Update: TESTING.md, SECURITY_GERAL.md, PRD_GERAL.md, TDD_GERAL.md, GAP_ANALYSIS (both). | Geral |
| P2-5 | **7-day grace period UX feedback** | User feedback flags grace period as hostile UX. Consider adding clear countdown + notification in claim page. | Geral |
| P2-6 | **Off-chain centralization disclosure** | Users can't claim without frontend/backend (need Merkle proofs). Consider adding proof export or emergency claim docs. | Joint |

### P3 — Stretch / Post-Week-6

| # | Feature | Detail |
|---|---------|--------|
| P3-1 | Dark/Light mode | PRD stretch goal |
| P3-2 | Multi-language (i18n) | PRD stretch goal |
| P3-3 | Real-time event feed | WebSocket dashboard enhancement |
| P3-4 | Token-2022 support | Needs transfer fee hook audit |
| P3-5 | Squads v4 multisig | No partner demand yet |
| P3-6 | Mainnet deployment | Requires formal security audit |

---

## Suggested Execution Order (Remaining)

### 1 — Final Validation

1. Run one final manual E2E pass after Lana answers cancel-design decision.
2. Update formal E2E checklist with real pass/fail notes.
3. Re-run `pnpm --dir apps/web lint` and `pnpm --dir apps/web exec tsc --noEmit` before handoff.

### 2 — Docs / Demo Readiness

4. Update `docs/TESTING.md` with current manual flows: funding recovery, native SOL claim, cancel grace, cancel settle.
5. Document local test requirements: local Postgres URL and Playwright OS dependency (`libnspr4.so` on this machine).
6. Add explicit UX copy/disclosure for bulk cancel grace behavior.

### 3 — Deployment Checks

7. Confirm event tables/migrations exist in production Supabase.
8. Confirm admin/manual sync path for demo, because Vercel hobby cron is limited.
9. Keep P2/P3 items as post-submission unless Lana asks to prioritize them.

---

## Key Files Changed (Geral Branch)

### Smart Contract
- `programs/vesting/src/instructions/cancel_campaign.rs` — pause→cancel exploit fix
- `programs/vesting/src/instructions/cancel_stream.rs` — dual-path rewrite (SPL + native)
- `programs/vesting/src/instructions/claim.rs` — native SOL claim
- `programs/vesting/src/instructions/create_campaign.rs` — `handler_native`
- `programs/vesting/src/instructions/create_stream.rs` — `handler_native`
- `programs/vesting/src/instructions/fund_campaign.rs` — `handler_native`
- `programs/vesting/src/instructions/withdraw.rs` — native SOL path
- `programs/vesting/src/instructions/withdraw_unvested.rs` — native SOL path
- `programs/vesting/src/errors.rs` — 3 new errors
- `programs/vesting/src/lib.rs` — 3 new instruction entries

### Backend
- `apps/web/src/lib/api/route-wrapper.ts` — centralized route guards
- `apps/web/src/lib/indexer/event-indexer.ts` — all-event indexer (522 lines)
- `apps/web/src/lib/indexer/state-sync.ts` — on-chain state sync
- `apps/web/src/lib/indexer/claim-events.ts` — checkpoint persistence
- `apps/web/src/lib/db/schema.ts` — 6 event tables + sync_state
- `apps/web/src/lib/db/migrations/0003_rls_policies.sql`
- `apps/web/src/lib/db/migrations/0004_event_tables.sql`
- `apps/web/src/lib/db/migrations/0005_timeline_indexes.sql`

### Frontend
- `apps/web/src/hooks/useCreateCampaign.ts` — native SOL + auto-wrap
- `apps/web/src/hooks/useCreateStream.ts` — native SOL + auto-wrap
- `apps/web/src/hooks/useWrapSol.ts` — partial unwrap
- `apps/web/src/hooks/useLocalCampaigns.ts` — batched fetching
- `apps/web/src/hooks/useCampaignDetail.ts` — recipients + milestones
- `apps/web/src/hooks/useProofLookup.ts` — 404 handling
- `apps/web/src/lib/anchor/errors.ts` — better error messages
- `apps/web/src/app/(app)/campaign/[id]/allocations/page.tsx` — new page

### Tests
- `tests/vesting-native-sol.spec.ts` — 12 native SOL tests
- `tests/security.spec.ts` — EXPLOIT 12
- `tests/vesting.clock.spec.ts` — clock tests
- `tests/vesting.supplementary.spec.ts` — supplementary tests

---

## Diff Summary

```
192 files changed, 20,133 insertions(+), 2,989 deletions(-)
```

---

*This is a working document. Update status as items are completed.*
