# Week 6 Execution Plan

Last updated: 2026-05-26

## Goal

Week 6 fokus pada:

1. menstabilkan flow vesting utama di frontend
2. menyelesaikan E2E testing untuk claim / pause / cancel / milestone
3. memisahkan mana issue yang bisa diselesaikan di frontend vs mana yang harus diselesaikan oleh Lana di SC / BE / deploy / DB

## Ownership

### Geral / Frontend

- integrasi frontend untuk native SOL vs wSOL
- UX dan state handling pada:
  - create
  - fund
  - claim
  - pause / unpause
  - cancel
  - withdraw unvested
  - release milestone
- list page `/campaigns`
- detail page `/campaign/[id]`
- E2E manual testing
- dokumentasi issue runtime dan hasil test

### Lana / Smart Contract / Backend / Deploy

- source-of-truth behavior program
- deploy devnet
- IDL final
- event indexing backend
- schema DB / Supabase
- milestone / root rotation semantics
- event tables tambahan:
  - `cancel_events`
  - `milestone_events`
  - `pause_events`
  - `root_update_events`
  - `stream_cancel_events`
  - `withdraw_events`

## Current Frontend State

### Done

- native SOL dan wSOL sudah dipisah dengan benar
- bulk `Create & Fund` sudah jadi satu aksi UI
- compatibility path untuk claim devnet drift sudah jalan
- linear bulk recipient sekarang menampilkan metrics personal:
  - `Your Allocation`
  - `You Claimed`
  - `Your Claimable`
- `/campaigns` recipient row sudah menampilkan:
  - `Your Allocation`
  - `Total Supply`
  - `Claimable Now`
- detail page multi-recipient punya modal `Recipients`
- pause state untuk bulk claim sudah disable tombol dengan benar
- loading flash pada recipient metrics multi-recipient sudah diganti skeleton
- fallback local campaign sekarang tetap digabung walau API hanya partial

### Temporary / Workaround

- claim compatibility masih belum bisa dianggap final karena deploy devnet belum sinkron penuh
- native / SPL claim path masih membawa beberapa workaround kompatibilitas
- beberapa fallback UI masih menahan kondisi account hilang setelah claim final

## Week 6 Priorities

### Priority 1 — Core E2E Validation

- validate single stream flow
- validate bulk campaign flow
- validate recipient-only metrics dan status
- validate state sync setelah claim penuh

### Priority 2 — Milestone Validation

- test milestone existing flow apa adanya dulu
- catat bug partial success / wallet approval / indexing
- baru putuskan refactor milestone manual

### Priority 3 — Lana Dependencies

- minta konfirmasi deploy / IDL / DB drift
- minta kejelasan source 6 event tables di Supabase
- minta final behavior untuk milestone dan root rotation

## E2E Checklist

## 1. Single Stream — Cliff

- [ ] create single cliff stream
- [ ] tunggu unlock
- [ ] claim full
- [ ] refresh page
- [ ] verify status berubah ke `Claimed`
- [ ] verify claim button tidak aktif lagi

## 2. Single Stream — Linear

- [ ] create single linear stream
- [ ] claim partial
- [ ] verify remaining claimable turun benar
- [ ] claim lagi setelah beberapa waktu
- [ ] verify status final dan button state

## 3. Single Stream — Milestone

- [ ] create milestone stream
- [ ] verify recipient tidak bisa claim sebelum release
- [ ] release milestone dari creator
- [ ] verify recipient bisa claim sesudah release
- [ ] verify status sinkron di detail page dan `/campaigns`

## 4. Bulk Campaign — Cliff

- [ ] create bulk cliff dengan 2 recipient
- [ ] claim recipient A
- [ ] claim recipient B
- [ ] verify `totalClaimed` benar
- [ ] verify kedua recipient tidak melihat allocation wallet lain

## 5. Bulk Campaign — Linear

- [ ] create bulk linear dengan 2 recipient
- [ ] claim partial dari recipient A
- [ ] claim partial dari recipient B
- [ ] verify `Your Allocation`, `You Claimed`, `Your Claimable`
- [ ] verify `/campaigns` dan detail page sinkron

## 6. Bulk Campaign — Milestone

- [ ] create bulk milestone
- [ ] release milestone yang tepat
- [ ] verify recipient yang sesuai bisa claim
- [ ] verify unreleased milestone tetap blocked

## 7. Pause / Unpause

- [ ] pause campaign
- [ ] verify claim blocked
- [ ] verify button / status paused benar
- [ ] unpause campaign
- [ ] verify claim jalan lagi

Note:

- behavior saat ini: pause memblok claim, tetapi tidak membekukan accrual linear

## 8. Cancel / Withdraw Unvested

- [ ] test `Instant Settle` untuk single stream
- [ ] test `Grace Period`
- [ ] verify beneficiary tetap bisa claim vested portion
- [ ] verify creator hanya bisa withdraw unvested setelah grace period

## 9. Allocation Editor / Root Update

- [ ] test hanya di campaign khusus
- [ ] open allocation editor
- [ ] verify recipient list / root version tampil benar
- [ ] verify payload publish flow hanya setelah core flows stabil

## Milestone Focus

## Current Problem

Milestone manual saat ini masih membuat:

- `Milestone #0`
- `Milestone #1`
- `Milestone #2`

sebagai stream terpisah.

Efeknya:

- wallet approval berulang
- bisa terjadi partial success
- sender dan recipient melihat milestone sebagai beberapa stream, bukan satu grant

## Recommended Direction

Milestone manual sebaiknya direfactor menjadi:

- 1 beneficiary
- banyak milestone row
- submit jadi 1 campaign
- claim dan release berdasarkan `milestone_idx`

## But Not Yet

Refactor milestone manual jangan dilakukan sebelum:

- [ ] baseline test milestone existing selesai
- [ ] bug indexing / wallet approval / list visibility dipahami
- [ ] Lana confirm behavior final SC untuk duplicate beneficiary milestone leaves dalam satu campaign

## Open Issues To Re-Test

## High Priority

- [ ] single-stream claim full harus langsung pindah ke `Claimed`
- [ ] `/campaigns` dan detail page harus sinkron sesudah claim
- [ ] milestone manual partial success harus dicatat dengan detail runtime
- [ ] recipient metrics multi-recipient jangan flash ke global state

## Medium Priority

- [ ] wallet balance refresh delay di devnet
- [ ] event/indexing delay dari backend
- [ ] local fallback vs indexed DB consistency

## Lana Follow-Up

## Must Confirm

- [ ] devnet binary sekarang sinkron atau tidak dengan source terbaru
- [ ] IDL final berasal dari deploy mana
- [ ] 6 event tables di Supabase dibuat dari migration mana
- [ ] apakah 6 event tables itu memang expected dan production-intended
- [ ] apakah RLS / policy untuk event tables sudah benar

## DB / Supabase Audit

Tables yang sudah expected di repo:

- `campaigns`
- `root_versions`
- `leaves`
- `claim_events`
- `waitlist`

Tables tambahan yang perlu dijelaskan sumbernya:

- `cancel_events`
- `milestone_events`
- `pause_events`
- `root_update_events`
- `stream_cancel_events`
- `withdraw_events`

Current conclusion:

- table tambahan itu tidak berasal dari perubahan frontend pada sesi ini
- besar kemungkinan berasal dari Lana / BE / schema push / migration branch lain

## Testing Notes Template

Gunakan format ini untuk setiap bug:

```md
### Flow
- single / bulk
- cliff / linear / milestone

### Wallet
- sender:
- recipient:

### Expected
- ...

### Actual
- ...

### Logs
- console:
- toast:
- tx signature:

### Notes
- reproducible / intermittent
```

## Recommended Order Today

1. test milestone existing flow
2. test bulk linear lagi sesudah patch metrics
3. test pause / unpause
4. test cancel / withdraw unvested
5. baru test allocation editor

## Definition of Done For Week 6

- semua flow utama sudah dites minimal sekali end-to-end
- bug FE yang bisa diselesaikan tanpa Lana sudah ditutup
- issue yang butuh Lana sudah terdokumentasi jelas
- milestone current behavior sudah dipahami
- keputusan refactor milestone manual bisa dibuat berdasarkan hasil test, bukan asumsi
