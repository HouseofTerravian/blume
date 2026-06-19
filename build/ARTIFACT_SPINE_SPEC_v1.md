# ARTIFACT / ROUTER-TAG SPINE — SPEC v1
**Date:** 2026-06-19 · **Status:** Specification (no code) · **Systems:** S1 Artifact Engine + S2 Router-Tag Engine
**Owner:** BLUME-MCP · **Ledger tasks:** BLUME-003, 010, 011, 020, 021, 073, 074 (+ 072 versioning)
**Reads with:** `ARCHITECTURE.md`, `docs/doctrine/blume-q1-q2-q3-resolution.md`, `COVERAGE_REPORT_v1.md`

---

## 0. Why this is the #1 leverage gap (validation of the Coverage Report)

**Claim:** the Artifact/Router-Tag Spine is one of the two highest-leverage missing systems.

**Evidence it is missing (from as-built code):**
- `blume/src/vault/types.ts` → `VaultEntry = {id, vault, brand, title, content, tags, metadata, createdAt, updatedAt}`. **Missing 5 of the 10 router-tag contract fields:** `uuid` (id is `Date.now()+random`, not a UUID), `switch`, `version`, `source`, `hash`.
- Vault category is a **brittle integer 1–8** whose meaning **disagrees with doctrine** (code `1=published-works`, doctrine `1=Brand Assets`). There is no stable canonical key.
- No content hash → no dedupe, no integrity proof, no un-backdatable guarantee.
- Storage is `thq_vault_entries` (Supabase) + local JSON, with ad-hoc `id`s.

**Evidence it is highest-leverage (dependency graph):** the router-tag *is the BLUME-MCP ↔ Terravian-MCP interface* (doctrine). Every downstream system consumes the artifact contract:
```
Artifact Spine ─┬─→ Lotus Engine (scores artifacts by vault/switch)
                ├─→ Recommendation (S5) — reads scores + artifacts
                ├─→ Audit Engine (S12) — needs hash + immutable ts + versions
                ├─→ Investor Engine (S10) — readiness artifacts
                ├─→ Publishing (S13) — emits proof-of-use artifacts
                └─→ Terravian-MCP routing (S15) — routes by router-tag
```
Nothing downstream can be correct until the atomic unit and its envelope exist. **Build order is forced: Spine first, then Lotus, then the rest.**

---

## 1. Responsibilities
1. Define **the Artifact** — BLUME's atomic unit — and persist it durably with a stable identity.
2. Define and enforce **the Router-Tag contract** — the metadata envelope that travels with every artifact across the MCP boundary.
3. Assign on ingest: `uuid`, `timestamp` (immutable), `version`, `source`, `hash` (deterministic content hash).
4. Own the **canonical vault registry** (stable string slugs + doctrine tier), decoupling category meaning from legacy integers.
5. Provide **validation** (reject malformed router-tags) and **retrieval** (by uuid / brand / vault / switch / hash).
6. Provide **versioning** — immutable originals; new versions append with lineage to the original `uuid`.
7. Provide a **one-time migration** of legacy `thq_vault_entries` / `VaultEntry` rows into artifacts by slug (no data loss).

## 2. Boundaries
**Owns:** the artifact table, the router-tag schema + validator, hashing, versioning, the vault-slug registry, ingest + retrieval tools.
**Does NOT own / do:**
- **Scoring / readiness** → Lotus Engine (S4). The spine stores; Lotus reads + scores.
- **Cross-brand routing / permission** → Terravian-MCP (S15). The spine emits a router-tag; routing decides destination.
- **Content generation** → Content Engine (S17). Generators *produce* artifacts; the spine *ingests* them.
- **Publishing** → S13. Publishing *calls* ingest to record proof-of-use artifacts.
- The spine **subsumes `VaultEntry` over time** — `VaultEntry` becomes a legacy view/precursor; new writes go through the artifact contract.

## 3. Inputs
- **Ingest payload:** `{ brand, title, body|ref, vault?, switch?, source?, metadata? }` (vault defaults to `creative-drafts` if omitted; switch optional).
- **Generated content** from S17 (post/email/offer/SEO) handed in as ingest payloads.
- **Publishing callbacks** (S13) → proof-of-use / published-works artifacts.
- **Legacy rows** from `thq_vault_entries` (migration input).
- **Vault registry config** (the canonical slug↔tier↔doctrine-number map).

## 4. Outputs
- **Artifact record** with assigned `{uuid, version, hash, timestamp, source}` and a complete, valid **router-tag**.
- **Router-tag object** (the exact MCP-boundary contract) for Terravian-MCP.
- **Validation result** `{ valid: bool, errors: [...] }`.
- **Retrieval results** (single by uuid; lists filtered by brand/vault/switch/source/time).
- **Version chain** for an artifact (original + successors).
- **Migration report** (counts mapped/failed by slug).

## 5. Router-Tag Contract (canonical — the MCP interface)
```
RouterTag {
  uuid       : string  (v4, stable, primary key)        // REQUIRED
  brand      : string  (brand slug; FK)                  // REQUIRED
  vault      : string  (canonical vault SLUG, see §7)    // REQUIRED
  switch     : int 1..7 | null   (Sales Switch)          // optional
  title      : string                                    // REQUIRED
  timestamp  : ISO-8601 (created; immutable)             // REQUIRED
  version    : int >= 1                                   // REQUIRED
  source     : enum {blume-generated, manual, imported, published, system}  // REQUIRED
  hash       : string  (sha256 of canonical body)        // REQUIRED
  metadata   : jsonb   { campaign?, channels?, platform?, parent_uuid?, ... }  // open
}
```
**Artifact = RouterTag + `body|ref` (+ `updated_at`).** The router-tag is the artifact minus its payload — the part that crosses the boundary.
**Validator rules:** all REQUIRED present + typed; `vault ∈ registry`; `switch ∈ 1..7 | null`; `source ∈ enum`; `version ≥ 1`; `hash` matches recomputed body hash; `timestamp` not in the future.

## 6. MCP Tools
| Tool | Purpose | Key args | Returns |
|---|---|---|---|
| `artifact_ingest` | Create an artifact; auto-assign uuid/ts/version=1/hash/source; validate | brand, title, body, vault?, switch?, source?, metadata? | artifact + router-tag |
| `artifact_get` | Fetch one by uuid | uuid | artifact |
| `artifact_list` | Query/filter | brand, vault?, switch?, source?, since?, limit? | artifacts[] |
| `artifact_version` | Append a new immutable version of an existing artifact | uuid, body, metadata? | new version (vN+1) |
| `routertag_validate` | Validate a router-tag against the contract | routertag | {valid, errors[]} |
| `routertag_get` | Return just the router-tag for an artifact | uuid | router-tag |
| `vault_registry` | List canonical vault slugs + tier + doctrine number + legacy int | — | registry[] |
| `artifact_migrate_legacy` | One-time backfill `thq_vault_entries` → artifacts by slug | dry_run? | migration report |

## 7. Database Structures (Supabase, `thq_` prefix — matches live convention)
**`thq_artifacts`** (new — the spine table)
```
uuid         uuid       PK
brand        text       not null      (idx)
vault        text       not null      (idx)   -- canonical SLUG, FK→registry
switch       int        null          (idx)   -- 1..7
title        text       not null
body         text       null                  -- inline content
ref          text       null                  -- pointer (storage url) if not inline
source       text       not null              -- enum
version      int        not null default 1
parent_uuid  uuid       null                  -- version lineage (null = original)
hash         text       not null      (idx)   -- sha256(canonical body); dedupe signal
timestamp    timestamptz not null            -- immutable creation
updated_at   timestamptz not null
metadata     jsonb      not null default '{}'
```
Indexes: `(brand, vault)`, `(brand, switch)`, `(hash)`, `(parent_uuid)`.
Immutability: `timestamp`, `hash`, `version` write-once; updates create a new version row (no in-place content edits).

**`thq_vault_registry`** (canonical category map — fixes the integer permutation)
```
slug         text  PK         -- e.g. "brand-assets"
doctrine_no  int              -- 1..12 (doctrine order)
display      text             -- "Brand Assets"
tier         text             -- core | extended | sovereign
legacy_int   int  null        -- old code 1..8 (compat)
active       bool             -- compliance(10) parked = false-ish
```
Seed (doctrine order; **note name-alignment to legacy means migration is by slug**):
`brand-assets(1,core,legacy4)`, `published-works(2,core,legacy1)`, `proof-of-use(3,core,legacy2)`, `commerce-evidence(4,core,legacy3)`, `creative-drafts(5,core,legacy6)`, `internal-notes(6,core,legacy7)`, `legal(7,core,legacy5)`, `investor(8,core,legacy8)`, `rnd(9,extended,—)`, `compliance(10,extended,parked)`, `memory(11,sovereign,—)`, `library(12,sovereign,—)`.

*(Audit chain — hashed append-only log, un-backdatable enforcement — is S12 and builds ON these primitives; not duplicated here.)*

## 8. Success Criteria
1. `artifact_ingest` returns an artifact whose router-tag passes `routertag_validate` 100% of the time; malformed inputs are rejected with field-level errors.
2. `uuid` is a stable v4; `artifact_get(uuid)` round-trips identical body + hash.
3. `hash` is deterministic (same body → same hash) and detects duplicates.
4. `timestamp`/`version`/`hash` are write-once; editing content yields `version+1` with `parent_uuid` set, original intact.
5. `vault` is always a canonical slug from `thq_vault_registry`; **no consumer depends on the legacy integer**.
6. `artifact_migrate_legacy` maps every `thq_vault_entries` row to an artifact **by slug** with a zero-loss report.
7. **Hand-off test:** Lotus can call `artifact_list(brand, vault, switch)` and receive everything it needs to score — i.e. the spine is a sufficient substrate for S4. *(This is the literal precondition for the Lotus spec.)*
