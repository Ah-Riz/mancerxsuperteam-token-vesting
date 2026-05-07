Lana → AC 1-6 done (skeleton, structs, test, README, CI). Kamu → AC #7 (partner verify). Deadline 3 hari (May 9).
GERAL_TASKS.md → cukup?
Cukup buat lulus. Belum cukup buat nilai bagus.
Scoring breakdown + kontribusi kamu:

  ┌───────────────────┬─────┬─────────────────────────────────────────────────────────────────┐
  │     Kategori      │ Pts │              Kontribusi dari partner verify saja?               │
  ├───────────────────┼─────┼─────────────────────────────────────────────────────────────────┤
  │ Code Organization │ 15  │ ❌ Lana yg scaffold. Kamu 0 commit di sini                      │
  ├───────────────────┼─────┼─────────────────────────────────────────────────────────────────┤
  │ README Quality    │ 15  │ ✅ Fixes = direct contribution                                  │
  ├───────────────────┼─────┼─────────────────────────────────────────────────────────────────┤
  │ DevOps            │ 10  │ ⚠️ CI udah ada. PR kamu green = bukti, tapi bukan kamu yg build │
  ├───────────────────┼─────┼─────────────────────────────────────────────────────────────────┤
  │ Account Structs   │ 5   │ ❌ Lana                                                         │
  ├───────────────────┼─────┼─────────────────────────────────────────────────────────────────┤
  │ Insight           │ 5   │ ✅ Report kamu sendiri                                          │
  └───────────────────┴─────┴─────────────────────────────────────────────────────────────────┘

  Pure partner-verify path → kamu cuma clearly own 20/50 pts (README + Insight). Sisanya reviewer bisa kasih partial credit, tapi risky.

  Strategi buat Maximize Score

  Hari ini (May 6) — clone + follow README + stopwatch. Catat SEMUA friction. Lebih banyak friction = lebih banyak commit = lebih bagus buat kamu.

  Tambahan di luar GERAL_TASKS.md (masih Week 3 scope, bukan Week 4):

  1. CI improvement → DevOps 10 pts
    - Add caching (Solana/Anchor cache → faster builds)
    - Add lint step
    - Ini visible commit, langsung map ke DevOps scoring
  2. Scaffold apps/web/ → Code Organization 15 pts
    - npx create-next-app + Tailwind + basic structure
    - Belum perlu logic, cukup folder structure yg match Week 2 arsitektur
    - GERAL_TASKS.md bilang "out of scope" tapi task brief TIDAK bilang begitu. Week 2 doc bilang kamu own frontend. Minimal scaffold = kontribusi visible ke Code Organization
  3. Merkle byte-equal test → Week 2 bilang ini "Day 1 Week 3 test gate"
    - TS unit test: keccak256(LEAF_PREFIX || leaf) === Rust golden hex
    - Ini di Week 2 arsitektur kamu sendiri yang tulis. Bukan Week 4 work — ini Week 3 joint test gate
  4. README verification badge → README Quality 15 pts
    - "Build verified by @geral on 2026-05-0X. Clone-to-deploy in N min" (ini ada di GERAL_TASKS.md, do it)

  Priority Order

  1. Clone + time + screenshot          ← TODAY, wajib
  2. README fixes (setiap fix = 1 commit) ← TODAY/besok
  3. CI caching/lint improvement        ← besok (DevOps pts)
  4. apps/web scaffold (Next.js init)   ← besok (Code Org pts)
  5. Merkle TS test gate                ← kalau sempat (bonus)
  6. PR + report                        ← May 8 latest


  Pure partner-verify path → kamu cuma clearly own 20/50 pts (README + Insight). Sisanya reviewer bisa kasih partial credit, tapi risky.

  Strategi buat Maximize Score

  Hari ini (May 6) — clone + follow README + stopwatch. Catat SEMUA friction. Lebih banyak friction = lebih banyak commit = lebih bagus buat kamu.

  Tambahan di luar GERAL_TASKS.md (masih Week 3 scope, bukan Week 4):

  1. CI improvement → DevOps 10 pts
    - Add caching (Solana/Anchor cache → faster builds)
    - Add lint step
    - Ini visible commit, langsung map ke DevOps scoring
  2. Scaffold apps/web/ → Code Organization 15 pts
    - npx create-next-app + Tailwind + basic structure
    - Belum perlu logic, cukup folder structure yg match Week 2 arsitektur
    - GERAL_TASKS.md bilang "out of scope" tapi task brief TIDAK bilang begitu. Week 2 doc bilang kamu own frontend. Minimal scaffold = kontribusi visible ke Code Organization
  3. Merkle byte-equal test → Week 2 bilang ini "Day 1 Week 3 test gate"
    - TS unit test: keccak256(LEAF_PREFIX || leaf) === Rust golden hex
    - Ini di Week 2 arsitektur kamu sendiri yang tulis. Bukan Week 4 work — ini Week 3 joint test gate
  4. README verification badge → README Quality 15 pts
    - "Build verified by @geral on 2026-05-0X. Clone-to-deploy in N min" (ini ada di GERAL_TASKS.md, do it)

  Priority Order

  1. Clone + time + screenshot          ← TODAY, wajib
  2. README fixes (setiap fix = 1 commit) ← TODAY/besok
  3. CI caching/lint improvement        ← besok (DevOps pts)
  4. apps/web scaffold (Next.js init)   ← besok (Code Org pts)
  5. Merkle TS test gate                ← kalau sempat (bonus)
  6. PR + report                        ← May 8 latest

  Report Template (tulis jujur)

  - Built: Partner verification AC#7. Clone-to-devnet in N min. Fixed X README gaps. Improved CI with caching + lint. Scaffolded apps/web/ Next.js structure matching Week 2 arch.
  - Split: Lana = AC 1-6 (program, structs, test, CI). Geral = AC 7 (verify) + CI improvement + frontend scaffold + README QA.
  - Insight: [friction kamu temuin — ini yg paling penting. Reviewer mau liat kamu PIKIR, bukan cuma execute]

  TL;DR

  GERAL_TASKS.md = minimum viable. Buat nilai bagus → tambah CI improvement + apps/web scaffold + merkle test. Semua masih Week 3 scope. Mulai clone SEKARANG — 3 hari tight.