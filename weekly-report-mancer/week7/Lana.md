# Weekly Report — Lana (Week 7)

**Scope:** BE-DB-SC-Merkle (backend API, Postgres/indexer, Solana program, Merkle client). This week included devnet deployment/config alignment **plus** drafting Week 7 test/validation plans (integration flows, edge cases, security review, coverage, feature validation).

**This week (chronological):** Align `Anchor.toml` cluster to devnet → deploy latest `vesting.so` upgrade to devnet program ID → verify on-chain program metadata → draft Week 7 test/validation work items and acceptance criteria.

---

## Status — What works and what doesn't

### Working

| Area | Item | Evidence |
|------|------|----------|
| **SC** | Devnet upgrade deployed | `solana program deploy` signature `2APdqFPgdRboc8QThpb2EfR7gVGRqemegvLJLTbf1sVgSMDHv3Y9PexECKuBRPmDWyLTD7AF9yzbmDxMZqqZqfAn` |
| **SC** | Program ID preserved | `G6iaigUdi2btFwUc2N65twfxwA8Ew5uKKhKJ5RJa8wvu` |
| **SC** | Upgrade authority unchanged | `GPfHeZtBna1rJmwam1yCcREhYnLcxWhBmUdDoVuL5Es6` |
| **SC** | Post-deploy program metadata | `Last Deployed In Slot: 466620187` |
| **Config** | Devnet cluster set in `Anchor.toml` | `cluster = "devnet"` (was `localnet`) |
| **QA (planning)** | Week 7 validation plan captured | Prompt docs covering integration flows, edge cases, security checklist, coverage goals, and feature validation questions (see `/home/lana/Documents/learn/mancer-scholarship/week7/prompt-(1..5)*`) |

### Incomplete / deferred

| Item | Owner | Notes |
|------|-------|-------|
| Devnet smoke suite for Week 6 features (`instant_refund_campaign`, native SOL path) | BE/SC | Localnet green from Week 6; this week focused on shipping the upgrade + config alignment |
| Integration tests: end-to-end flows across BE+DB+SC+Merkle | BE/SC/DB | Planned new test file: `tests/week7-integration-flow.spec.ts` (drafted flows + acceptance criteria; not implemented yet) |
| Edge case suite (30 cases) with explicit error-code assertions | SC | Planned new test file: `tests/week7-edge-cases.spec.ts` (drafted cases; requires dedupe vs existing tests) |
| Security review + SC security tests + report | SC (+ report) | Planned new SC tests: `tests/week7-security-sc.spec.ts`; API/DB findings documented (no harness planned) |
| Coverage report + gap-filling tests + documentation | SC (+ docs) | Planned tooling (`cargo-llvm-cov`/`tarpaulin`), tests: `tests/week7-coverage-gaps.spec.ts`, report: `docs/WEEK7_COVERAGE_REPORT.md` |
| Feature validation checklist + Merkle cost comparison + bug list | BE/SC/DB (+ docs) | Planned report: `docs/WEEK7_FEATURE_VALIDATION_REPORT.md` with PASS/FAIL evidence once executed |

---

## Blockers — What's stuck or what you need

**No blockers for devnet deployment.** Week 7 QA items are currently in planning/draft state and need implementation + execution time (tests + reports).

---

## Metrics — Quantifiable progress

| Metric | Value |
|--------|-------|
| Devnet deploys executed | **1** successful upgrade |
| Program ID | `G6iaigUdi2btFwUc2N65twfxwA8Ew5uKKhKJ5RJa8wvu` |
| Deploy signature | `2APdqFPgdRboc8QThpb2EfR7gVGRqemegvLJLTbf1sVgSMDHv3Y9PexECKuBRPmDWyLTD7AF9yzbmDxMZqqZqfAn` |
| Last deployed slot | **466620187** |
| Repo config changes | `Anchor.toml` cluster: localnet → devnet |
| Week 7 QA prompt docs drafted | **5** (integration, edge cases, security, coverage, feature validation) |
| Planned new test suites | **4** (`week7-integration-flow`, `week7-edge-cases`, `week7-security-sc`, `week7-coverage-gaps`) |
| Planned new Week 7 reports | **2** (`WEEK7_COVERAGE_REPORT`, `WEEK7_FEATURE_VALIDATION_REPORT`) |

