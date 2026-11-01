# TPIG Retrieval Ledger

**Status:** The ledger migration (`20261031221514`, accepted at `301d2cb`) was **APPLIED to production `revenue-core` on 2026-11-01 and verified** (16 of 16 checks; evidence `revenue-core-infra/audit/deploy/20261101-ledger-deployment-evidence.md`). The ledger is **empty**: no writer exists and no retrieval path is wired. Operational launch remains blocked on the writer, O3 (backups) and O5 (retention).
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

- **System of record:** `public.thq_retrieval_events` in the shared `revenue-core` database. Append-only. The BLUME writer (service role) has `SELECT` only and writes exclusively through the `SECURITY DEFINER` function `thq_append_retrieval_event(jsonb)`; there is no direct table `INSERT` for it.
- **Writer (future, BLUME):** builds events from a typed allowlist, passes any structured field through the Correction 6 sanitizer, computes the canonical row hash client-side, and calls `thq_append_retrieval_event`. It treats `inserted` and `duplicate` as success and everything else as failure, never retries a conflict, and never surfaces a database error's message, detail or hint to a caller or log (it maps errors to a closed code).
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
- Writes enter through `thq_append_retrieval_event`, which checks the **shape and type of every value before any cast** (lower-case uuid pattern, integer pattern of at most 9 digits, boolean, calendar-valid millisecond timestamp, array of strings). A database type error would otherwise echo the rejected value (`invalid input syntax for type uuid: "..."`). It refuses unknown keys **without naming them**, refuses client-supplied `recorded_at`/`txid`, and caps the payload at 8 KiB.
- A conflicting duplicate raises a fixed message (`event_id conflict` or `(retrieval_id, seq) conflict`); no row values appear in it.
- The reconciliation view exposes counts, ids and timestamps only.
- Writers must never put a provider message, URL or query text into any field; there is nowhere to put it.

## 7. Canonical row hash (D7)

`row_hash = sha256` of the UTF-8 string formed by joining these 30 fields in this order with the unit separator `0x1f`: `event_id, retrieval_id, seq, phase, event_type, schema_version, provider, engine, query_policy, sanitize_policy, param_names, query_length, has_location, data_type, num_requested, save_requested, rejected_field, reason_codes, error_code, stage, result_count, served_from_cache, artifact_uuid, artifact_hash, retention_ref, retention_scope, affected_rows, writer_id, app_version, occurred_at`.

Formatting: NULL is the empty string (no field is ever empty otherwise); booleans `true`/`false`; arrays comma-joined; UUIDs lowercase; `occurred_at` as UTC `YYYY-MM-DDTHH:MM:SS.mmmZ`. `recorded_at`, `txid` and `row_hash` are excluded.

The database verifies the hash on insert and the reconciliation view re-checks stored rows. A test compares the database result with an independent JavaScript implementation. **This detects corruption and writer bugs; it is not tamper-proof evidence**, because anyone able to insert can compute a valid hash.

## 8. Delivery and failure behaviour (D2, D3)

**Default (strict):**

1. Mint `retrieval_id`. Call `thq_append_retrieval_event` with `provider_attempt` and wait for `inserted` (or `duplicate`, on a retry) within a bounded timeout and retries.
2. If it is not acknowledged, **do not call the provider.** The caller receives a generic ledger-unavailable error with no detail.
3. After the provider returns, insert the outcome and archive events as one batch with bounded retries.
4. If outcome events cannot be recorded in strict mode, the retrieval is left as an attempt with no outcome. Reconciliation reports it (`incomplete_retrieval`, or `archive_outcome_missing`). **Decided (O1):** sanitized results may still be returned, flagged `ledger_degraded`, but **only after a durably acknowledged `provider_attempt`**. If the attempt was not acknowledged, no provider call is made and nothing is returned.

**Optional outbox fallback (explicit opt-in; less durable). Decided (O4): disabled for the initial release; not built or enabled until separately approved.**

- Off by default. Enabled only by an explicit setting.
- Bounded: at most a fixed number of events and a fixed maximum age (proposed 200 events and 24 hours; to be ratified). When either bound would be exceeded, the writer fails closed and no new attempt is made.
- Monitored: a status command and every tool response report backlog count and age (numbers only).
- The outbox holds only the same allowlisted event payloads, never query text. Events are removed from it only after the database acknowledges them. It is not a debug mirror and is not retained after delivery.
- Less durable, and said so: a single machine's disk. Events still in the outbox when that machine is lost are lost. In outbox mode the attempt can precede database acknowledgement.

**Idempotency and retry:** `event_id` is generated once per event and reused on every retry. The append function compares the canonical `row_hash` when the `event_id` already exists: an **identical** retry returns `duplicate` (no error, no second row); a **conflicting** payload under the same `event_id` raises, so it is never a silent no-op. `(retrieval_id, seq)` is unique, so two different events cannot claim the same slot, and that conflict also raises a fixed message.

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
| `orphan_artifact_reference` | `archive_succeeded` points at an artifact that no longer exists and no `scope = artifact` `retention_exception` explains it (a `ledger_rows` exception never excuses one) |
| `conflicting_outcomes` | More than one provider outcome, or more than one archive outcome, on one retrieval |
| `artifact_hash_mismatch` | Recorded hash differs from the artifact's hash |
| `artifact_without_ledger` | A raw-signal artifact newer than the ledger's first event has no `archive_succeeded` |
| `pre_ledger_artifact` | Informational: a raw signal older than the ledger (for example c0dc83b0) |
| `row_hash_mismatch` | A stored row no longer matches its canonical hash |

Reconciliation never repairs data. Resolution is a human decision recorded elsewhere.

## 11. Access control

- Row level security enabled, no policies. `anon`, `authenticated` and `PUBLIC` have no privileges on the table, the view or any helper function.
- `service_role`: `SELECT` on the table and the view; `EXECUTE` on exactly two functions, `thq_append_retrieval_event` (the write path) and `thq_retrieval_event_row_hash` (reconciliation tooling re-checks stored rows). **No** `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` or `TRIGGER`, and no `EXECUTE` on any internal helper. Production's default privileges grant `EXECUTE` on every new function to `service_role`, so the migration revokes it explicitly and grants back only these two.
- The single `SECURITY DEFINER` function runs with `search_path = pg_catalog, pg_temp` (no `public`); every object reference inside it is schema-qualified. It can only `INSERT`, and it refuses `retention_exception`.
- Any future consumer gets a narrower approved view, never the base table.
- The retention GUC `thq.ledger_retention_reason` is separate from the raw-signal guard's GUC, so one authorization cannot open the other.

## 12. Retention, deletion and append-only protection

**Unresolved (flagged):** TPIG leaves retention periods open. With D5 there is **no automatic deletion, so retention is currently indefinite.** That is a gap to resolve with a ratified schedule, not an accepted end state.

**Append-only guarantees:** `UPDATE` is never permitted. `TRUNCATE` is never permitted. `DELETE` is permitted only under a retention exception. These guard against accidents and ordinary application paths; a database administrator can drop the triggers, and a drop is an incident visible in migration history.

**Retention exception (how deletion coexists with append-only):** only the **owner / migration role** can record or use one. A version-controlled, Founder-approved migration, in **one transaction**:

1. sets `thq.ledger_retention_reason` with `set_config(..., true)` (transaction-local; never session or role level), with text that **names the evidence file**;
2. inserts exactly one `retention_exception` event **directly** (the append function refuses this type), with `retention_ref` equal to that file, the scope, the affected row count, and `artifact_uuid` only for scope `artifact`;
3. deletes the narrowly named rows and asserts the deleted count equals `affected_rows`.

Enforced by the database, not by convention:

- **R1:** a `retention_exception` is accepted only from a role that holds `DELETE` on the ledger (the writer role does not), only while the reason is set, and only if the reason names the row's `retention_ref`. `artifact_uuid` is required for scope `artifact` and forbidden for scope `ledger_rows`.
- **R2:** a `DELETE` is allowed only when the reason is set **and** a `retention_exception` row from the **same transaction** exists whose `retention_ref` the reason names. An exception from an earlier transaction authorizes nothing, and a stale reason about another file authorizes nothing.
- **R3:** a `DELETE` statement may not remove more rows than the same-transaction `ledger_rows` exceptions declare in `affected_rows`; an `artifact`-scope exception authorizes no ledger-row deletion.
- `retention_exception` rows can never be deleted, `UPDATE` and `TRUNCATE` are never permitted, and ledger rows are removed **by whole retrieval only** (a partial removal is reported as `sequence_gap`).

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

All of it runs against the **final integrated migration** (no overlay) in an isolated local PostgreSQL (`revenue-core-infra/scripts/local-test/`; throwaway cluster on loopback, simulated Supabase roles, never connects to Supabase).

| Suite | Checks | Result |
|---|---|---|
| Main regression (`run.sh`) | 218 (the original 163 preserved, plus append-function contract, retention coupling, delete cap, reconciliation scoping) | all pass |
| Adversarial security gate (`ADVERSARIAL=1`) | 52 SQL (the original 47, plus 2 definer checks and 3 layer tests) and 5 bash-level (concurrent writers, atomic apply, re-apply, genuine non-superuser escalation) | all pass |
| Mutation testing (`mutation/run-mutations.sh`) | 37 mutants, each removing or weakening one protection | 36 detected, 1 survived (1 expected-redundant), 0 failed to apply |

The mutation set covers the pre-existing protections (grants, RLS, validation, append-only triggers, hash order, uniqueness, legacy exemption) and every new one (R1 guard trigger and each of its checks, R2 evidence-file binding, R3 delete cap, R4 append function: duplicate-conflict comparison, pre-cast validation, unknown keys, size cap, `search_path`, `SECURITY DEFINER`, EXECUTE grants, calendar validity, seq-conflict message, R5 orphan scope and conflicting outcomes). `R4b` removes the append function's refusal of `retention_exception`; it survives alone because the R1 guard trigger also refuses it (defense in depth), and `R4b2` (both layers removed) is detected.

**Specified for the later writer (not built; needs separate approval):** strict mode makes no provider call when the attempt is not acknowledged; `ledger_degraded` only after an acknowledged attempt (O1); allowlist builder refuses unknown fields; no query text or hash in rejection events; no free-text errors; database errors never surfaced; one `retrieval_id` and monotonic `seq` per retrieval; archive link matches artifact uuid and hash; sanitization-unverified writes no content; Correction 6 and raw-signal guard behaviour preserved (existing suite stays green). The outbox is disabled for the initial release (O4) and has no tests until separately approved.

## 15. Cost and operations (D9 findings)

- **Volume (estimate):** about 3 to 6 events per retrieval and roughly 600 bytes plus indexes per row. At 50 retrievals a day that is about 100 MB a year; at 500 a day about 1 GB a year. The current `thq_events` table is 80 kB.
- **Latency:** at most 2 database round trips per retrieval (attempt, then a batched outcome). A rough 0.3 to 0.5 s added against a 1 to 5 s provider call (estimate).
- **Plan and backups (verified read-only 2026-10-31):** the CLI reports the project's backup configuration as `WALG: true`, `PITR: false`, and **no restorable backups listed** (earliest and latest timestamps 0). The CLI does not expose the plan tier, so **the tier is not assumed**. What this means: the ledger's durability today equals the database's own, with **no point-in-time recovery and no listed backup to restore from**. Confirming the plan and available backups remains open (O3).

## 16. Implementation plan (gated; nothing below is authorized yet)

1. **Done:** security-gate remediation R1-R5 integrated into the migration; final-form regression, adversarial and mutation testing recorded (`revenue-core-infra/audit/predeploy/`).
2. Founder review of this document, the integrated migration and the evidence.
3. Founder authorization to apply the migration **as an empty table**, using the same gated, scripted flow as migration `20261031192720` (prerequisites in section 18).
4. Writer module in BLUME with mocked-database tests, built to the writer rules in section 3.
5. Wire the retrieval path: `provider_attempt` before transmission, then outcome/archive events. Strict mode only (outbox disabled, O4).
6. Reconciliation script and a status command.
7. Legacy import: dry run again, then a real run only on separate written authorization.

## 17. Founder policy decisions and open items (updated 2026-10-31, security gate)

| | Item | Status |
|---|---|---|
| O1 | Outcome-write failure in strict mode | **Decided:** sanitized results may return with `ledger_degraded` only after a durably acknowledged `provider_attempt`. |
| O2 | `result_count` exemption for `legacy-import` rows | **Approved as specified** (section 13). Tested: it extends no further than `provider_succeeded`. |
| O3 | Backup and plan verification | **Open.** Verified read-only: PITR off, no restorable backup listed, WAL archiving running; plan tier not exposed and not assumed. Must be resolved (or compensated, for example by periodic checkpoints) before the ledger is described as durable audit evidence. |
| O4 | Outbox | **Decided:** disabled for the initial release. |
| O5 | Retention schedule | **Unresolved. Tracked as a launch blocker for full operational launch** (not for applying an empty table). Until ratified, ledger retention is indefinite. |

## 18. Pre-deployment security gate and remediation integration (2026-10-31)

Gate report: `revenue-core-infra/audit/predeploy/20261031-ledger-security-gate.md`. Integration evidence: `revenue-core-infra/audit/predeploy/20261031-ledger-remediation-integration.md`.

**Gate outcome (before remediation):** the migration as first committed failed 4 of 8 areas (9 distinct findings, 2 High): forgeable permanent `retention_exception` rows, silent drop of conflicting duplicate events, retention-exception replay and over-delete, rejected values echoed by type errors, and reconciliation gaps.

**Integrated (R1-R5), final form:** every finding is closed and the dedicated table, strict allowlists, RLS, append-only protections and reconciliation view are preserved. Results: main suite 218/218, adversarial 52 SQL + 5 bash, mutation 36 of 37 detected (the 1 survivor is the documented redundant layer).

**Exact deployment prerequisites (applying the EMPTY table):**

1. Founder review and **separate written authorization** to apply.
2. Apply only through the gated, scripted flow: a scratch workdir linked to revenue-core (ref ending `jqek`), the repo clean at the reviewed commit, the migration directories byte-identical, a dry run that lists **exactly** `20261031221514_thq_retrieval_events_ledger.sql`, and a remote history that is exactly the expected pre-apply state (latest `20261031192720`, 76 entries). Post-apply expectation: latest `20261031221514`, 77 entries.
3. Re-verify read-only immediately before applying: Postgres version, no name collisions, default privileges unchanged, `thq_artifacts` columns unchanged.
4. After applying, verify read-only against production: RLS on, `service_role` holds `SELECT` only on the table and the view, exactly 5 triggers and 8 functions, exactly one `SECURITY DEFINER` function pinned to `pg_catalog, pg_temp`, `EXECUTE` limited to the owner plus `service_role` on two functions, zero rows, and the reconciliation view readable (expect one `pre_ledger_artifact` row, c0dc83b0). Record an evidence file.
5. The assumption that the Supabase CLI applies a migration file in one transaction is checked by the post-apply verification (a partial apply would show missing objects).
6. Rollback is `DROP` of the objects listed in the migration header, valid only while the table is empty.

**Not prerequisites for applying an empty table, but blockers for operational launch:** the writer built to the rules above with its own tests; O3 (a restorable backup or a compensating checkpoint; PITR is off and no restorable backup is listed); O5 (a ratified retention schedule).

## 19. Deployment record (2026-11-01)

- **Applied once**, by the Founder, through the gated scripted flow (`revenue-core-infra/scripts/deploy/`): preflight PRE-1 to PRE-7 all passed; history went from `20261031192720:76` to `20261031221514:77`; no error, no rollback.
- **Verified read-only:** RLS on with no policies; `service_role` holds `SELECT` only; exactly 8 functions, one `SECURITY DEFINER` pinned to `pg_catalog, pg_temp`; `EXECUTE` held by `service_role` on the append and row-hash functions only; exactly 5 triggers, all enabled; **zero rows**; reconciliation view readable with only `pre_ledger_artifact` (c0dc83b0); the ledger is in no publication; the structural fingerprint equals the tested migration's on all four components.
- **One verifier defect found and fixed** (not a deployment defect): the first V11 run failed because the CLI treats a leading `--` argument as a flag, and because Postgres 18 (test cluster) lists `NOT NULL` as constraint rows that Postgres 17.6 (production) does not. The fingerprint now excludes `NOT NULL` constraint rows (they are covered by the column definitions) and the expected value was recomputed from the tested migration and matched production independently.
- **Unchanged and still open:** the writer is not built (nothing writes to the ledger); **O3** backups (PITR off, no restorable backup listed, plan tier not exposed); **O5** retention schedule unresolved (retention indefinite). The writer must follow the rules in section 3 and section 18.
- **Known documentation defect:** the migration header's `ROLLBACK:` list drops the table before the row-hash function, which fails; the tested rollback template (`scripts/deploy/rollback/`) has the correct order. The header was left as accepted.
