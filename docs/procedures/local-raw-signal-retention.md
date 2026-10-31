# Local raw-signal retention procedure (DRAFT, not authorized for execution)

**Status:** Draft prepared 2026-10-31 under Correction 6, decision D2 (approved in principle). **No deletion is authorized by this document.** Execution needs a separate written Founder authorization naming the exact uuid(s).
**Governs:** local copies of TPIG raw signals under `vaults/_artifacts/house/` (gitignored, local only). The database side is governed by the retention migration procedure in `revenue-core-infra` (migration `20261031055000`).

## Why this exists

The local JSON copy is the "primary" store (`src/artifacts/store.ts`). Raw signals are write-once locally (`flag: "wx"`), which blocks overwrite but not deletion, and the database retention migration does not touch local files. A record removed from the database can therefore remain on disk and be served by `artifact_get` (read-time redaction now removes capability URLs from what is returned, but the file itself is unchanged).

## First target: b605c34b

- A pre-policy `tpig-raw-0` test signal (matcha trends, 2026-10-31).
- Removed from `thq_artifacts` by migration `20261031192720` (verified, evidence in `revenue-core-infra/audit/retention/`).
- The local copy still holds 4 SerpAPI capability URLs. It is superseded by the sanitized signal c0dc83b0, which must be preserved.

## Preconditions (all must hold, and be checked first)

1. Written Founder authorization naming the exact file/uuid and this procedure.
2. The database row is already gone, or its removal is authorized by an approved migration (never delete the local copy of a row that still exists in the database).
3. The superseding record exists locally and in the database and its hash verifies.
4. The target path resolves inside `vaults/_artifacts/house/` and is exactly one file named `<uuid>.json`.

## Steps

1. **Pre-check (read-only).** Report: the file exists; byte length; sha256 of the file (a hash is not sensitive); count of `serpapi.com/searches/` occurrences (a number only); the stored `hash` equals `computeHash(body)`. Do not print the file or any URL.
2. **Preserve the evidence of what is being removed.** Record the file sha256 and the stored artifact hash in the evidence file. The content itself is not copied anywhere.
3. **Delete exactly that one file.** No glob, no directory delete.
4. **Post-check.** The file is absent; the directory still holds the superseding record; `getArtifact(<uuid>)` returns null for the removed uuid and succeeds for the preserved one.
5. **Evidence.** Commit an evidence note under `docs/evidence/` (counts, masked identifiers, hashes, timestamps; no content), then push.

## Limits to state in the evidence

- The deletion is not recoverable from this repository (`vaults/` is gitignored).
- The file may persist in OS-level backups or file-history snapshots on this machine.
- The regression test `test/signals/historical.test.ts` skips the real-file cases automatically once the file is gone; the synthetic fixture cases continue to run.

## Not in scope

Database deletion (separate migration procedure), retention periods by signal category (TPIG open question), the durable retrieval ledger (Correction 5).
