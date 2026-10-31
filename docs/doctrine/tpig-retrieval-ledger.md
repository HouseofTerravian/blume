# TPIG Retrieval Ledger

**Status:** DRAFT for Founder review. Conditionally ratified design decisions (Correction 5, 2026-10-31); implementation NOT wired, migration NOT applied.
**Schema version:** `tpig-ledger-1`
**Owners:** `revenue-core-infra` owns the table, constraints, triggers, privileges and reconciliation view (migration `20261031221514_thq_retrieval_events_ledger.sql`). BLUME owns this doctrine, the event contract and, later, the writer. TerravianHQ and ASSIST are read-only consumers.
**Governance:** operates under TPIG (provisional): "Every retrieval and transformation shall be logged"; "Maintain immutable histories of retrieval"; "minimize unnecessary retention of personal data". Preserves `tpig-query-policy-1` and `tpig-sanitize-2` (see `tpig-query-and-pii-policy.md`) and the write-once raw-signal guards.

## 1. Ratified decisions (with the Founder's modifications)

| | Decision |
|---|---|
| D1 | Dedicated table `thq_retrieval_events`. `thq_events` is not reused. |
| D2 | A **database-acknowledged** attempt is required by default. A local outbox fallback must be explicitly enabled, bounded, monitored, and is documented as less durable. |
| D3 | `retrieval_id` is minted and the attempt recorded **before** provider transmission. |
| D4 | **No accepted-query text by default.** Only minimal typed metadata and policy/version identifiers. Any query-text retention needs separate approval. |
| D5 | No automatic deletion until a retention schedule is ratified. **Indefinite retention is an unresolved item, not a decision.** |
| D6 | Legacy JSONL: dry run only. No import without separate authorization. |
| D7 | Canonical row hash for integrity checking. It is not tamper-proof evidence. |
| D8 | Migration tested in isolated local PostgreSQL before any production consideration. |
| D9 | Deferred: plan and backup capability must be verified, not assumed (see section 15). |
| D10 | No persistent JSONL debug mirror. A bounded fallback outbox is permitted only under D2. |

## 2. Purpose and non-goals

The ledger answers, durably and auditably: which retrievals were attempted, which were rejected before sending, what each provider call and archival step produced, and whether output was withheld. It exists so that the answer does not depend on one machine's local file.

Not in scope: storing queries or provider payloads (those are policy-governed elsewhere), scoring or routing (TPIG Stages 2+), rate limiting, and retention schedules.

## 3. Architecture

- **System of record:** `public.thq_retrieval_events` in the shared `revenue-core` database. Append-only. Inserted only by the BLUME writer through the service role.
- **Writer (future, BLUME):** builds events from a typed allowlist, passes any structured field through the Correction 6 sanitizer, inserts with `on conflict (event_id) do nothing`.
- **Outbox (optional, D2):** a bounded local buffer used only when explicitly enabled and the database is unreachable. It is drained and emptied; it is never retained as a log.
- **Reconciliation (read-only):** the `thq_retrieval_reconciliation` view reports problems and resolves nothing.

## 4. Event model

Phases distinguish what happened. Provider attempts, provider outcomes, archival outcomes and output withholding are separate event types and never share one.

| Phase | Event type | Meaning |
|---|---|---|
| screening | `query_rejected` | Rejected before sending. Nothing was transmitted. Reason codes only. |
| provider | `provider_attempt` | Recorded and acknowledged **before** transmission. |
| provider | `provider_succeeded` | The provider returned a usable response. |
| provider | `provider_failed` | The provider call failed. Closed error code only. |
| archive | `archive_succeeded` | A raw signal was written; carries `artifact_uuid` and `artifact_hash`. |
| archive | `archive_failed` | The archive write failed. Closed error code only. |
| sanitization | `sanitization_failed` | Redaction could not be verified. Names the stage only. |
| output | `output_withheld` | Output was withheld from the caller. |
| retention | `retention_exception` | Marks an approved removal of ledger rows or an artifact (section 12). |

Typical flows (one `retrieval_id`, `seq` increasing from 1):

- Rejected: `query_rejected` (seq 1).
- Normal, not saved: `provider_attempt` -> `provider_succeeded`.
- Normal, saved: `provider_attempt` -> `provider_succeeded` -> `archive_succeeded`.
- Provider error: `provider_attempt` -> `provider_failed`.
- Redaction failure: `provider_attempt` -> `provider_succeeded` -> `sanitization_failed` -> `output_withheld`.

## 5. Schema specification (`tpig-ledger-1`)

Every column is a closed enum, a bounded number, a UUID, a hex digest, a boolean, or a short token matched by a strict pattern. **No column can hold query text, provider messages, URLs or free text.**

| Column | Type | Rule |
|---|---|---|
| `event_id` | uuid PK | client-generated; the idempotency key |
| `retrieval_id` | uuid | minted before transmission; shared by all events of one retrieval |
| `seq` | int 1..1000 | unique per `retrieval_id` |
| `phase`, `event_type` | text | closed sets; fixed mapping (section 4) |
| `schema_version` | text | `tpig-ledger-1` |
| `provider` / `engine` | text | `serpapi`; `google`, `google_events`, `google_maps`, `youtube`, `google_news`, `google_trends` |
| `query_policy` / `sanitize_policy` | text | `tpig-query-policy-N` / `tpig-sanitize-N` |
| `param_names` | text[] | subset of `q, search_query, location, geo, date, data_type, num`; sorted (C collation), unique; **names only, never values** |
| `query_length` | int 0..256 | length of the query, not its content |
| `has_location` | bool | whether a location was supplied |
| `data_type` | text | `TIMESERIES, GEO_MAP, RELATED_QUERIES, RELATED_TOPICS` |
| `num_requested` | int 1..20 | |
| `save_requested` | bool | whether archival was requested (drives reconciliation) |
| `rejected_field` | text | `q, location, geo, date, engine, data_type, num` |
| `reason_codes` | text[] | the Correction 6 closed set; sorted, unique |
| `error_code` | text | `http_NNN`, `timeout`, `network`, `provider_error`, `archive_write`, `archive_mirror`, `archive_unknown`, `sanitization_unverified` |
| `stage` | text | `params, response, title, archive-body, output, log-event` |
| `result_count` / `served_from_cache` | int / bool | cost and quality signals |
| `artifact_uuid` / `artifact_hash` | uuid / hex64 | the archive correlation; no foreign key (retention may remove artifacts) |
| `retention_ref` | text | `audit/retention/<file>` or `docs/evidence/<file>`; no 32+ hex run |
| `retention_scope` / `affected_rows` | text / int | `ledger_rows` or `artifact`; count |
| `writer_id` / `app_version` | text | opaque configured tokens (<= 40 chars), never a hostname; no 32+ hex run |
| `occurred_at` | timestamptz | client time, millisecond precision, not before 2026, not more than a day ahead |
| `recorded_at`, `txid` | server | **always assigned by the database; client values are ignored** |
| `row_hash` | hex64 | canonical integrity hash (section 7) |

**Per-type field matrix.** Required (R) and permitted (O) fields; every other field must be NULL.

| Event type | Required | Optional |
|---|---|---|
| `query_rejected` | provider, query_policy, rejected_field, reason_codes | engine |
| `provider_attempt` | provider, engine, query_policy, param_names, query_length (>=1), has_location, save_requested | data_type, num_requested |
| `provider_succeeded` | provider, engine, result_count | served_from_cache |
| `provider_failed` | provider, engine, error_code | |
| `archive_succeeded` | artifact_uuid, artifact_hash, sanitize_policy | provider, engine |
| `archive_failed` | error_code, sanitize_policy | provider, engine |
| `sanitization_failed` | stage, sanitize_policy | provider, engine |
| `output_withheld` | sanitize_policy | provider, engine, stage |
| `retention_exception` | retention_ref, retention_scope, affected_rows | artifact_uuid |

Adding a provider, engine, event type, reason code or field is a migration and a new schema version. It is never a runtime configuration.

## 6. How the schema enforces privacy

- A `BEFORE INSERT` trigger validates every field and raises a **fixed message naming only the field** (for example `field "writer_id" violates the allowlist`). Database CHECK and NOT NULL violations attach the failing row to the error detail, so the trigger runs first and the CHECK constraints are an unreachable backstop. Tests confirm a marker placed in a rejected field never appears in the error message or detail.
- Unique-key errors (`event_id`, `(retrieval_id, seq)`) mention only UUIDs.
- The reconciliation view exposes counts, ids and timestamps only.
- Writers must never put a provider message, URL or query text into any field; there is nowhere to put it.

## 7. Canonical row hash (D7)

`row_hash = sha256` of the UTF-8 string formed by joining these 30 fields in this order with the unit separator `0x1f`: `event_id, retrieval_id, seq, phase, event_type, schema_version, provider, engine, query_policy, sanitize_policy, param_names, query_length, has_location, data_type, num_requested, save_requested, rejected_field, reason_codes, error_code, stage, result_count, served_from_cache, artifact_uuid, artifact_hash, retention_ref, retention_scope, affected_rows, writer_id, app_version, occurred_at`.

Formatting: NULL is the empty string (no field is ever empty otherwise); booleans `true`/`false`; arrays comma-joined; UUIDs lowercase; `occurred_at` as UTC `YYYY-MM-DDTHH:MM:SS.mmmZ`. `recorded_at`, `txid` and `row_hash` are excluded.

The database verifies the hash on insert and the reconciliation view re-checks stored rows. A test compares the database result with an independent JavaScript implementation. **This detects corruption and writer bugs; it is not tamper-proof evidence**, because anyone able to insert can compute a valid hash.

## 8. Delivery and failure behaviour (D2, D3)

**Default (strict):**

1. Mint `retrieval_id`. Insert `provider_attempt` and wait for the database acknowledgement (bounded timeout and retries).
2. If it is not acknowledged, **do not call the provider.** The caller receives a generic ledger-unavailable error with no detail.
3. After the provider returns, insert the outcome and archive events as one batch with bounded retries.
4. If outcome events cannot be recorded in strict mode, the retrieval is left as an attempt with no outcome. Reconciliation reports it (`incomplete_retrieval`, or `archive_outcome_missing`). The caller is told the ledger is degraded. See open item O1.

**Optional outbox fallback (explicit opt-in; less durable):**

- Off by default. Enabled only by an explicit setting.
- Bounded: at most a fixed number of events and a fixed maximum age (proposed 200 events and 24 hours; to be ratified). When either bound would be exceeded, the writer fails closed and no new attempt is made.
- Monitored: a status command and every tool response report backlog count and age (numbers only).
- The outbox holds only the same allowlisted event payloads, never query text. Events are removed from it only after the database acknowledges them. It is not a debug mirror and is not retained after delivery.
- Less durable, and said so: a single machine's disk. Events still in the outbox when that machine is lost are lost. In outbox mode the attempt can precede database acknowledgement.

**Idempotency and retry:** `event_id` is generated once per event and reused on every retry. Inserts use `on conflict (event_id) do nothing`, so a lost acknowledgement followed by a retry is harmless. `(retrieval_id, seq)` is unique, so two different events cannot claim the same slot.

## 9. Failure recovery matrix

| Failure | Behaviour |
|---|---|
| Database unreachable before the attempt (strict) | No provider call; generic error |
| Database unreachable before the attempt (outbox on) | Queue, proceed, flush later; bounds enforced |
| Insert succeeds, acknowledgement lost | Retry with the same `event_id`; duplicate ignored |
| Crash between attempt and outcome | Attempt without outcome -> `incomplete_retrieval` |
| Crash between outcome and archive | `archive_outcome_missing` (when save was requested) |
| Archive written, `archive_succeeded` not recorded | `artifact_without_ledger` |
| Event inserted out of order | `sequence_gap` or `outcome_without_attempt` until the missing event arrives |
| Corrupt or torn outbox line | Quarantined and counted, never silently dropped |
| Machine lost with unflushed outbox | Those events are lost (outbox mode only; documented) |

## 10. Reconciliation

`thq_retrieval_reconciliation` (read-only, `security_invoker`, service role only) reports, per row: `issue`, `retrieval_id`, `artifact_uuid`, `event_count`, `first_recorded_at`.

| Issue | Meaning |
|---|---|
| `incomplete_retrieval` | Attempt with no provider outcome after the grace window (default 15 minutes) |
| `archive_outcome_missing` | Provider success, archival requested, no archive/sanitization/withholding event after the grace window |
| `outcome_without_attempt` | Outcome events with no attempt (legacy-import rows are excluded) |
| `sequence_gap` | `max(seq)` differs from the number of events |
| `orphan_artifact_reference` | `archive_succeeded` points at an artifact that no longer exists and no `retention_exception` explains it |
| `artifact_hash_mismatch` | Recorded hash differs from the artifact's hash |
| `artifact_without_ledger` | A raw-signal artifact newer than the ledger's first event has no `archive_succeeded` |
| `pre_ledger_artifact` | Informational: a raw signal older than the ledger (for example c0dc83b0) |
| `row_hash_mismatch` | A stored row no longer matches its canonical hash |

Reconciliation never repairs data. Resolution is a human decision recorded elsewhere.

## 11. Access control

- Row level security enabled, no policies. `anon`, `authenticated` and `PUBLIC` have no privileges on the table, the view or the helper functions.
- `service_role`: `SELECT` and `INSERT` only. `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` are revoked.
- Any future consumer gets a narrower approved view, never the base table.
- The retention GUC `thq.ledger_retention_reason` is separate from the raw-signal guard's GUC, so one authorization cannot open the other.

## 12. Retention, deletion and append-only protection

**Unresolved (flagged):** TPIG leaves retention periods open. With D5 there is **no automatic deletion, so retention is currently indefinite.** That is a gap to resolve with a ratified schedule, not an accepted end state.

**Append-only guarantees:** `UPDATE` is never permitted. `TRUNCATE` is never permitted. `DELETE` is permitted only under a retention exception. These guard against accidents and ordinary application paths; a database administrator can drop the triggers, and a drop is an incident visible in migration history.

**Retention exception (how deletion coexists with append-only):** ledger rows can be removed only by a version-controlled, Founder-approved migration that, in **one transaction**:

1. sets `thq.ledger_retention_reason` with `set_config(..., true)` (transaction-local; never session or role level);
2. inserts exactly one `retention_exception` event naming the evidence file, the scope, the affected row count and, for artifact removals, the `artifact_uuid`;
3. deletes the narrowly named rows and asserts the deleted count equals `affected_rows`.

The delete trigger allows a row only when the reason is set **and** a `retention_exception` row from the same transaction exists. An exception from an earlier transaction authorizes nothing. `retention_exception` rows can never be deleted, so the record of exceptions is itself permanent.

**Artifacts:** a future approved artifact removal records a `retention_exception` with `scope = artifact` and the `artifact_uuid`, so reconciliation does not report the ledger's `archive_succeeded` row as an orphan.

**b605c34b:** its removal (migration `20261031192720`) is **existing evidence**, held in `revenue-core-infra/audit/retention/`. It is not, and will not be, recorded as a ledger event, and the ledger never had rows for it. The legacy-import dry run below treats it accordingly.

## 13. Legacy JSONL: dry run only (D6)

No legacy record is imported, and none may be without separate authorization. A read-only dry run of the 4 existing lines (2026-10-31) found:

| Line | Format | Maps to | Findings |
|---|---|---|---|
| 1 | v0 (no `event`) | `provider_succeeded` only | Has `retrieved_at`. No `retrieval_id`, no result count. **References artifact `b605c34b`, which is gone and is existing evidence; the archive part must not be imported** (it would create an orphan reference). |
| 2 | v0 | `provider_succeeded` only | Same: time present, no `retrieval_id`, no result count. |
| 3 | v1 `retrieved` | `provider_succeeded` | Time and `retrieval_id` present; no result count. |
| 4 | v1 `save_ok` | `archive_succeeded` for `c0dc83b0` | Hash present and the artifact still exists; correlates to line 3 by `retrieval_id`. |

Findings that need a decision before any import:

- **Result count is unknown for every legacy provider outcome.** The migration therefore makes `result_count` required for `provider_succeeded` **except when `writer_id = 'legacy-import'`**, where it may be NULL. The normal writer is unaffected.
- No legacy line has a `provider_attempt`; reconciliation excludes `legacy-import` rows from `outcome_without_attempt`.
- Query text is not carried over (D4). Only parameter names and the query length (computed, not copied) would be.
- The import would be idempotent (deterministic ids derived from each line's digest). The local JSONL file would be kept; deleting it needs separate authorization.

## 14. Test matrix

**Implemented now: isolated local PostgreSQL** (`revenue-core-infra/scripts/local-test/run.sh`; throwaway cluster on 127.0.0.1, simulated Supabase roles, never connects to Supabase):

| Area | Cases |
|---|---|
| Privileges and RLS | anon / authenticated / PUBLIC have nothing on table, view or helper functions; `service_role` has SELECT and INSERT only; RLS enabled with no policies; view is `security_invoker`; exactly the expected triggers exist |
| Valid events | one of each event type accepted from the service role; optional fields may be omitted |
| Strict allowlists | 48 invalid events (unknown type/provider/engine/reason/error/stage/field values, phase mismatch, unsorted or duplicate arrays, forbidden and missing fields per type, the legacy-import exemption not extending beyond `provider_succeeded`, bad formats, out-of-range numbers, time bounds, null core fields), each rejected with the fixed message and **no marker leaked into message or detail** |
| Uniqueness and idempotency | duplicate `event_id` rejected; duplicate `(retrieval_id, seq)` rejected; `ON CONFLICT DO NOTHING` retry inserts nothing; next `seq` accepted |
| Row hash | known-answer vector equals an independent JavaScript implementation; a wrong or malformed hash is rejected |
| Server-owned columns | client `recorded_at` and `txid` are ignored |
| Append-only | UPDATE, DELETE and TRUNCATE blocked for the owner; denied for `service_role` |
| Retention exception | reason alone, exception alone and a session-level reason all fail; UPDATE and TRUNCATE stay blocked under an exception; the narrow delete works in one transaction; an earlier transaction's exception does not authorize a later delete; `retention_exception` rows cannot be deleted |
| Reconciliation | each issue is detected; healthy, not-requested-save, rejection-only, legacy-import and retention-covered cases are not flagged; non raw-signal artifacts are never listed; the service role can read the view |

The suite was also **mutation-tested**: the migration was deliberately broken in 12 ways (for example leaving default grants, dropping the validate trigger, allowing UPDATE, letting a reason alone permit DELETE, reordering the hash fields, disabling RLS) and the suite failed each time (three of the breakages abort the script outright instead of reporting a failed check, which also fails the run). The suite currently runs 163 checks, all passing.

**Specified for the later writer (not built; needs separate approval):** idempotent re-insert; strict mode makes no provider call when the attempt is not acknowledged; outbox bounds, ordered drain and removal only after acknowledgement; torn-line quarantine; crash between attempt and outcome; allowlist builder refuses unknown fields; no query text or hash in rejection events; no free-text errors; one `retrieval_id` and monotonic `seq` per retrieval; archive link matches artifact uuid and hash; sanitization-unverified writes no content; preserved Correction 6 and raw-signal guard behaviour (existing suite stays green).

## 15. Cost and operations (D9 findings)

- **Volume (estimate):** about 3 to 6 events per retrieval and roughly 600 bytes plus indexes per row. At 50 retrievals a day that is about 100 MB a year; at 500 a day about 1 GB a year. The current `thq_events` table is 80 kB.
- **Latency:** at most 2 database round trips per retrieval (attempt, then a batched outcome). A rough 0.3 to 0.5 s added against a 1 to 5 s provider call (estimate).
- **Plan and backups (verified read-only 2026-10-31):** the CLI reports the project's backup configuration as `WALG: true`, `PITR: false`, and **no restorable backups listed** (earliest and latest timestamps 0). The CLI does not expose the plan tier, so **the tier is not assumed**. What this means: the ledger's durability today equals the database's own, with **no point-in-time recovery and no listed backup to restore from**. Confirming the plan and available backups remains open (O3).

## 16. Implementation plan (gated; nothing below is authorized yet)

1. Founder review of this document, the migration and the local test results.
2. Founder authorization to apply the migration; apply with the same gated, scripted flow used for migration `20261031192720`, then verify and record evidence.
3. Writer module in BLUME with mocked-database tests (the specified writer tests above).
4. Wire the retrieval path: `provider_attempt` before transmission, then outcome/archive events. Strict mode only unless the outbox is separately enabled.
5. Optional outbox implementation, off by default, with its bounds and status command.
6. Reconciliation script and a status command.
7. Legacy import: dry run again, then a real run only on separate written authorization.

## 17. Open items needing Founder decisions

- **O1.** In strict mode, if outcome events cannot be recorded after the provider call, return the results with a degraded flag (proposed; the data is already paid for and withholding does not improve the record) or withhold them?
- **O2.** Ratify the `result_count` relaxation for `legacy-import` rows (section 13).
- **O3.** Verify the Supabase plan and available backups (D9), then decide whether periodic checkpoints are wanted.
- **O4.** Ratify the outbox bounds (proposed 200 events, 24 hours) if the outbox is ever enabled.
- **O5.** Retention schedule (D5): ledger retention is indefinite until one is ratified.
