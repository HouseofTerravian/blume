# STEALTH Vault Model — Canonical Doctrine v3.1

> **Status.** Ratified naming (Chude, 2026-06-25); architecture spec is **draft** (BLUME/Noo1 propose, Terravian ratifies). First artifact built. Optimize for **survivability, not elegance**.
> **Lineage.** Evolves the Proof Ledger (v1) → Evidence Operating System (v2) → STEALTH Vault Model (v3.1). Bridges [`blume-doctrine-v1.md`](./blume-doctrine-v1.md) R-1 (S.T.E.A.L.T.H.) and R-2 (Vault System).

---

## 0 · What it is

The **STEALTH Vault Model** is the estate-wide **evidence architecture** of House of Terravian — the **defensive** half of the S.T.E.A.L.T.H. nervous system, **separate from BLUME**.

- It is **not** a database of files. It is an **orchestrator of authoritative records**: it knows where each truth lives, holds a hash-verified copy, grades it by custodian authority, and continuously re-verifies it.
- It generates, grades, and preserves proof of authorship, public use, commerce, and registration for every brand — automatically, as work happens.
- Goal: *defend and preserve an entire IP portfolio for decades.*

This refines BLUME doctrine **R-2**: the Vault, formerly "the body of BLUME," is promoted to its own named, estate-level system (Terravian-MCP-owned). BLUME (BLUME-MCP, brand-level) writes S.T.E.A.L.T.H. tags; the Vault verifies and enshrines them.

| | BLUME | STEALTH Vault Model |
|---|---|---|
| Role | Offensive — marketing / proof-of-commerce intelligence | Defensive — evidence enshrinement (the vault) |
| Says | what *should* happen (build the signal) | proves what *did* happen (enshrine the proof) |
| Scope | brand-level | estate-level (all brands) |
| Owner | BLUME-MCP | Terravian-MCP |

---

## 1 · The S.T.E.A.L.T.H. matrix (R-1, restored 7-part)

Every artifact is tagged against this matrix so marketing output simultaneously builds legal/IP defense. Each layer maps to a Vault mechanism. **This restores `E — Enshrine the Evidence`,** the layer earlier 6-letter renderings dropped.

| | Layer | Vault mechanism |
|---|---|---|
| **S** | Secure the Signal | Chain genesis + conception record + content hash |
| **T¹** | Timestamp in Public | Dual public archive (Wayback + archive.today) · T1 |
| **E** | Enshrine the Evidence | The Vault itself — hash-chained, multi-custodian verified copies |
| **A** | Activate in Commerce | Commerce Records (Stripe / T2) · "no receipt, no commerce" |
| **L** | Lock in Legal Armor | Registrations (USPTO / Copyright · T0) |
| **T²** | Tangle the Terrain | Portfolio footprint & domains *(competitive half stays in BLUME, R-3)* |
| **H** | Haunt Their Hand | The deterrent — litigation & due-diligence packages |

**Unified ladder:** the S.T.E.A.L.T.H. order **is** the Evidence Lifecycle **is** the strength climb. One object, three lenses.

```
S  Secure the Signal     conception/commit    Weak
T¹ Timestamp in Public   Wayback / T1         ┐
E  Enshrine the Evidence Vault ledger + hash  ┘→ Strong
A  Activate in Commerce  Stripe / T2          ┐
L  Lock in Legal Armor   USPTO / T0           ┘→ Conclusive
T² Tangle the Terrain    portfolio footprint  (defensive moat)
H  Haunt Their Hand      deterrent / DD pkg   (emergent)
```

---

## 2 · Trust hierarchy

Not all evidence carries equal authority. Strength is **earned by independent authority, never asserted.**

| Tier | Custodian class | Examples |
|---|---|---|
| **T0** | Government registry / court | USPTO, Copyright Office, court |
| **T1** | Independent third party | archive.org, archive.today, RFC-3161 timestamp authority, CT logs |
| **T2** | Financial institution | Stripe, bank |
| **T3** | Infrastructure provider | Vercel, Netlify, Cloudflare, registrar, DNS |
| **T4** | Version control | Git commit hash |
| **T5** | Internal database | Notion, the Vault |
| **T6** | Human assertion | operator note, memory |

---

## 3 · Evidence strength model (derived, not hand-set)

```
Conclusive : ≥1 T0 attestation  OR  (independent T1 timestamp + T2 financial + content hash)
Strong     : ≥2 independent custodians ≤T3, incl. ≥1 ≤T2, + content hash + external timestamp
Moderate   : exactly one machine custodian ≤T4 (commit/deploy), hashable, single-custodian
Weak       : only T5–T6 (internal/human)
```
Strength is live — if an archive fails, strength can *drop*.

---

## 4 · Multi-custodian truth (the v3 correction)

Git is **not** the universal source of truth — it is the custodian of *source code*. Truth is **federated**: each system is authoritative for its own domain. The Vault orchestrates them and holds verified copies, so no single vendor's death is fatal.

```
        NATURAL WORK EVENTS (operator types ~nothing)
  git push | deploy | stripe charge | publish | registration
                          │
              ┌───────────▼───────────────┐
              │     VAULT ORCHESTRATOR     │
              │ capture·hash·archive·grade·verify
              └─────┬───────────────┬──────┘
                    ▼               ▼
      ┌─────────────────────┐  ┌──────────────────────┐
      │ VAULT INDEX (×3)    │  │ AUTHORITATIVE        │
      │ git (canonical idx) │  │ CUSTODIANS (truth)   │
      │ Notion (operator UI)│  │ USPTO·Stripe·archive │
      │ cold (S3/Backblaze) │  │ ·Vercel·registrar    │
      │ hashes + COPIES     │  └──────────────────────┘
      └──────────┬──────────┘
                 ▼
        INTELLIGENCE LAYER → alerts · portfolio metrics · gaps
```

**Authority comes from the live custodian; survival comes from the Vault's own copy.** They stop competing.

---

## 5 · Core databases (4)

1. **Case Files** (Brands) — one master per brand/entity; aggregates everything by relation + rollup (zero duplication).
2. **Evidence Chains** — one per mark / work / invention; `EC-<BRAND>-<TYPE>-<SLUG>`; auto-reconstructs chronology.
3. **Evidence Ledger** — unified custody records (every artifact, one shape: proof, publication, registration, domain, repo, deploy, asset…).
4. **Commerce** — kept separate (money schema + "no receipt, no commerce" rule + Stripe/T2 custody).

**Evidence Record shape:** `id · chain · case_file · record_type · custodian · trust_tier · external_id · retrieval_uri · content_hash · copy_uri · custodian_ts · captured_at · verification · last_verified_at · prior_record_hash · stealth_layer · strength_contrib`.

**S.T.E.A.L.T.H. coverage** is a derived per-chain rollup (`S·T¹·E·A·L·T²·H`) + `stealth_completeness` + `stealth_next` (lowest-uncovered layer = recommended next move). Per-record `stealth_layer` is derived deterministically from `record_type` + `custodian`.

---

## 6 · Field tiers (friction down, value up)

- **Required (MVL):** Title · Brand · Evidence Chain · Artifact Type · Proof Type · Captured At · (Live URL **or** Asset). *Often satisfied with ≤2 prompts, or zero via auto-capture.*
- **Recommended:** Mark · Repository · Commit · Wayback URL · Notes · Tags.
- **Automatic:** Entry ID · Created Time · repo/commit/branch/build/domain/env · Wayback URL · Content Hash · Prior-Record Hash · Custodian · Trust Tier · Operator.
- **Derived:** Evidence Strength · Chronology · Case Completeness % · Portfolio Strength · S.T.E.A.L.T.H. coverage.

---

## 7 · Automation (type as little as possible)

One **Terravian-MCP `evidence_capture` tool** + a **GitHub Actions post-deploy hook**. On every production deploy: gather repo/commit/branch/build/domain/env → hash the page → fire Wayback + archive.today → write the Evidence Record to **all stores** — no human keystroke. Stripe webhook → Commerce. USPTO/registrar pollers → Registration/Domain. The only manual field is *intent* (Title/notes).

**Operator workflow (<30s, usually 0s):** publish → automation fires → capture · hash · dual-archive · grade · chain · update Case File · recompute portfolio → one confirmation.

---

## 8 · AI-native rules

- Everything an agent needs is **typed, never prose** (timestamps ISO-8601 UTC, hashes, trust tier, strength, custodian, verification).
- **Claims vs evidence separated** by `record_type` (a conception is a claim; an archive is evidence).
- Stable opaque IDs; derivations carry a model version (`strength_model: v3`).
- Agent writes go through a validated, append-only, idempotent MCP tool (dedupe by `content_hash`) — agents cannot corrupt history.

---

## 9 · Intelligence layer

**Evidence Intelligence (alerts):** "chain missing A — no commerce" · "deploy without Wayback — strength capped" · "archive failed — strength dropped" · "registration deadline in N days" · "domain expires in N days" · "verification stale."

**Portfolio Intelligence (Case-File rollups):** completeness · risk · avg strength · weakest brands · needs commerce/publication · USPTO-ready · missing logos · expiring domains · chains lacking independent timestamps · estate S.T.E.A.L.T.H. coverage.

---

## 10 · Disaster recovery

Multi-custodian truth + triplicated index + verified copies = no single death is fatal.

| Catastrophe | Survives via |
|---|---|
| GitHub gone | local clones + Notion/cold index + hashes + Wayback + Vault copies |
| Notion gone | git + cold index (truth never lived in Notion) |
| Wayback gone | archive.today + Vault copy + content hash |
| Stripe closes | periodic receipt exports + PDF copies + hashes |
| Registrar changes | WHOIS history + certs + Vault copies |

---

## 11 · Scorecard (15 categories)

**A+:** Speed to Value · Evidentiary Strength · Scalability · Data Integrity · Boundary Clarity · Low Friction · Automation · Queryability · Auditability · AI Readability · Human Readability.
**A (limiting factor = actors outside estate sovereignty):** Adoption (humans must choose to file) · Longevity & Disaster Recovery (third-party permanence) · Legal Defensibility (judicial discretion). Claiming A+ there would be dishonest.

---

## 12 · Migration plan (v1 → v3.1)

1. Collapse to 4-DB core; map v2's tables into Evidence Ledger via `record_type`; keep Commerce separate.
2. Promote Brand/Mark/links from select/URL → true relations (Case Files, Chains).
3. Add v3 fields: real `captured_at` datetime, `content_hash`, `prior_record_hash`, `custodian`, `trust_tier`, `verification`, `stealth_layer`/`stealth_coverage`.
4. Backfill **Entry #1** into chain `EC-PBA-TM-EVERY-SCORE` (ASSIST™ homepage; Strong; coverage `S·T¹·E`, next = `A`).
5. Stand up `terravian-evidence` git index + `evidence_capture` MCP tool + cold mirror.
6. Wire custodian webhooks/pollers; turn on intelligence + estate rollup.
7. Backfill June 18 / June 19 milestones as Entries #2–3.

---

## 13 · Status & provenance

- **Built (v1 seed, 2026-06-25):** Notion **Proof Ledger** DB (inside Proof-of-Use vault) + Entry #1 = ASSIST™ homepage publication, chain `EC-PBA-TM-EVERY-SCORE`, Strength **Strong**.
- **Gated doctrine page:** `house-of-terravian/stealth-vault-model.html` (Noo World Login).
- **Feeds the system:** Wayback archiving discipline = Standing Instruction #21.
- **Governance:** BLUME/Noo1 propose; **Terravian ratifies.** Noo1 grades/feedback later.
