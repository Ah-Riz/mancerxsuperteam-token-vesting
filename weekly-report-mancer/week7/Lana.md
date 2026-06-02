# Weekly Report — Lana (Week 7)

**Scope:** BE-DB-SC-Merkle (backend API, Postgres/indexer, Solana program, Merkle client). This week was primarily devnet deployment + config alignment.

**This week (chronological):** Align `Anchor.toml` cluster to devnet → deploy latest `vesting.so` upgrade to devnet program ID → verify on-chain program metadata.

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

### Incomplete / deferred

| Item | Owner | Notes |
|------|-------|-------|
| Devnet smoke suite for Week 6 features (`instant_refund_campaign`, native SOL path) | BE/SC | Localnet green from Week 6; this week focused on shipping the upgrade + config alignment |

---

## Blockers — What's stuck or what you need

**No blockers.** Devnet upgrade succeeded and program metadata confirms the new slot.

---

## Metrics — Quantifiable progress

| Metric | Value |
|--------|-------|
| Devnet deploys executed | **1** successful upgrade |
| Program ID | `G6iaigUdi2btFwUc2N65twfxwA8Ew5uKKhKJ5RJa8wvu` |
| Deploy signature | `2APdqFPgdRboc8QThpb2EfR7gVGRqemegvLJLTbf1sVgSMDHv3Y9PexECKuBRPmDWyLTD7AF9yzbmDxMZqqZqfAn` |
| Last deployed slot | **466620187** |
| Repo config changes | `Anchor.toml` cluster: localnet → devnet |

