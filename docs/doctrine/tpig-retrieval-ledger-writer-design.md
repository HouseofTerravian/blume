# TPIG Retrieval Ledger: Writer Design

**Status:** IMPLEMENTED (2026-10-31) behind `BLUME_LEDGER_MODE=off` by default, NOT activated. W1-W12 ratified by the Founder with three refinements: (1) identical frozen-event retries only; (2) archive/ledger discrepancies must remain detectable; (3) no automatic strict-to-off fallback. Operations: `docs/runbooks/ledger-operations.md`. No production write, provider call, legacy import or deletion occurred.

**Implementation deviations from section 12 (recorded, none weakens a decision):**
- The `clock` failure class is folded into `validation`: the client reads only HTTP status and SQLSTATE, never messages, so a clock rejection is indistinguishable from an allowlist violation and is equally HARD.
- `src/config.ts` and `mcp/server.ts` are unchanged: the `ledger` summary is returned inside the serp/trends tool outputs.
- Two support modules were added beyond the seven planned: `ledger/index.ts` (entry point and test seams) and `ledger/reconcile.ts` (read-only reconciliation helpers used by the CLI).
**Date:** 2026-11-01
**Builds on:** `tpig-retrieval-ledger.md` (doctrine), `tpig-query-and-pii-policy.md` (Correction 6), and the deployed migration `20261031221514` in `revenue-core-infra` (**not modified by this work**).
**Contract it writes against:** `public.thq_append_retrieval_event(p jsonb) returns text` (verified on production: `SECURITY DEFINER`, executable by `service_role`, not by `anon`). The writer never uses direct `INSERT`.

## 1. What was inspected (read-only)

| Source | Finding that shapes the design |
|---|---|
| Production function signature | argument is named `p` (so the PostgREST call is `rpc("thq_append_retrieval_event", { p: event })`); returns `'inserted'` or `'duplicate'`; raises SQLSTATE `23000` (event_id conflict), `23505` ((retrieval_id, seq) conflict), `23514` (allowlist violation) |
| Deployed doctrine and migration | per-event-type required/forbidden field matrix; canonical `row_hash` over 30 fields; `recorded_at` and `txid` are server-assigned and refused if sent; payload cap 8 KiB |
| `src/signals/sources/serp.ts` | screening, then `fetchSerp`, then `recordRetrieval` (JSONL log plus optional archive), then output sanitization; the retrieval id is minted only after the provider call |
| `src/signals/envelope.ts` | `logSignalEvent` writes a local JSONL file; `recordRetrieval` mints `retrieval_id` and runs `saveRawSignal`; distinguishes `SanitizationFailure` |
| `src/artifacts/store.ts` | `persistArtifact`: local write-once file, then Supabase mirror; mirror failure throws a plain `Error` whose text starts `artifact mirror failed` |
| `src/integrations/supabase.ts` | one lazily created service-role client; other helpers `console.error(... error.message)` (database messages) |
| `package.json` | `@supabase/supabase-js` 2.106.2 installed (supports per-call `abortSignal`); Node 22 built-in test runner already in use (109 existing signals tests) |
| SerpAPI documentation reachable here | does **not** define how a cached response is marked (only the `no_cache` parameter), so `served_from_cache` has no verified source |

## 2. Architecture

```
MCP tool call (signal_serp_search / signal_google_trends)
        │
        ▼
 serp.ts (provider specifics: params, screening, fetch, sanitize)
        │  uses
        ▼
 ledger/flow  ──►  RetrievalRun  (one per retrieval: retrieval_id, seq counter, degraded state)
                         │ builds typed events          ledger/events.ts   (allowlist builders, canonical hash)
                         │ sends one event at a time     ledger/client.ts   (rpc + abort timeout + SQLSTATE → closed class)
                         │ applies retry / fail-closed   ledger/writer.ts   (policy: ack-required vs best-effort)
                         ▼
          thq_append_retrieval_event(p)   (deployed; the only write path)
```

- **One run object per retrieval.** It mints `retrieval_id`, hands out `seq` 1, 2, 3 in strict order, and serialises its own writes (each event is awaited before the next is created).
- **Two kinds of write.** The provider attempt is **ack-required** (nothing is sent to the provider unless it is durably acknowledged). Every other event is **best-effort with bounded retries**, and a failure only sets the run's `degraded` state.
- **Pure builders.** An event is built from closed facts (enums, counts, lengths, ids, policy versions), never from query text, URLs, provider payloads or error messages. It is frozen at creation, including `event_id` and `occurred_at`, so every retry sends identical bytes.
- **Mode switch.** `BLUME_LEDGER_MODE=off` (default) makes `begin()` return a no-op run, so merging the code changes nothing and today's behaviour (including the Correction 6 JSONL log) is unchanged. `strict` is activation and needs separate approval.
- **No outbox, no JSONL mirror** (decisions O4, D10): there is nothing on local disk to recover; a refused retrieval is simply refused.

## 3. Event sequencing and state diagram

```
 call
  │ mint retrieval_id (uuid, lower-case), seq = 0
  ▼
 SCREEN ── prohibited input ──► [query_rejected  seq1]  ──► REJECTED          (no provider call; error to caller;
  │                                best-effort write                            write failure only counted)
  │ screened ok
  ▼
 ATTEMPT_PENDING ── append(provider_attempt seq1) ──┬─ inserted | duplicate ─► ATTEMPTED
                      retries on network/timeout/5xx/429                       │
                                                    ├─ conflict / validation / permission / auth / missing function
                                                    │        (HARD, no retry) ─► REFUSED_HARD   no provider call
                                                    └─ still unacked after retries ─► REFUSED   no provider call
                                                       (both: error "ledger unavailable; no provider request was made")
 ATTEMPTED ── provider call (single attempt, 30 s) ──┬─ ok ──► [provider_succeeded seq2] ──► SUCCEEDED
                                                     └─ error ─► [provider_failed  seq2] ──► FAILED   (safe error to caller)
 SUCCEEDED ── sanitize response ──┬─ verified
                                  │    ├─ save not requested ─────────────────────────────► DONE        results returned
                                  │    └─ save requested ── archive ──┬─ ok ─► [archive_succeeded seq3] ─► DONE
                                  │                                   ├─ sanitization unverifiable ► [sanitization_failed seq3 stage]
                                  │                                   │                              ► [output_withheld seq4] ─► WITHHELD
                                  │                                   └─ write/mirror error ─► [archive_failed seq3 code] ─► DONE (+save_error)
                                  └─ output sanitization unverifiable ► [sanitization_failed stage=output] ► [output_withheld] ─► WITHHELD
 any non-attempt event that cannot be acknowledged ─► run.degraded = true (closed code recorded) ─► results STILL returned with ledger_degraded (O1)
```

Event sequences (one `retrieval_id`, `seq` ascending, no gaps when every write is acknowledged):

| Flow | Events |
|---|---|
| Rejected before sending | `query_rejected` |
| Normal, not saved | `provider_attempt`, `provider_succeeded` |
| Normal, saved | `provider_attempt`, `provider_succeeded`, `archive_succeeded` |
| Provider error | `provider_attempt`, `provider_failed` |
| Archive error | `provider_attempt`, `provider_succeeded`, `archive_failed` |
| Redaction unverifiable (archive) | `provider_attempt`, `provider_succeeded`, `sanitization_failed`, `output_withheld` |
| Archive ok, output unverifiable | `provider_attempt`, `provider_succeeded`, `archive_succeeded`, `sanitization_failed`, `output_withheld` |

## 4. Pre-provider durable acknowledgment, retries, idempotency

```
ackAttempt(event):                       # event frozen: same event_id, same occurred_at, same row_hash on every try
  for try in 1 .. (1 + RETRIES):
      r = client.append(event, timeout = ATTEMPT_TIMEOUT)
      if r in {inserted, duplicate}:        return ACKED               # duplicate = our own earlier send landed
      if r.class in HARD:                   return HARD_FAIL           # never retried
      sleep(backoff[try]) and continue                                 # network | timeout | server | rate_limited | unknown
  return UNACKED
```

- **Defaults (decision W5):** attempt ack timeout 5 s, 2 retries (3 tries), backoff about 250 ms then 750 ms; worst case about 16 s before refusing. Outcome events: 3 s, 1 retry.
- **Idempotent by construction.** A retry resends the identical event. If the first call committed but the response was lost, the retry returns `duplicate`, which counts as acknowledged. If the first call is still in flight when the retry arrives, the database serialises them and one is `inserted`, the other `duplicate`.
- **Conflicts are bugs, not retries.** `23000` (same `event_id`, different hash) and `23505` (a different event already holds this `(retrieval_id, seq)`) are classified HARD and are never retried. For the attempt they refuse the retrieval; for later events they set `degraded` and raise an alert-grade counter.
- **A provider call is never retried by the writer.** One retrieval is one provider attempt; a higher-level retry is a new `retrieval_id`.
- **HARD classes (no retry):** `conflict`, `seq_conflict`, `validation` (allowlist drift or a builder bug), `permission` (`42501`), `auth` (401/403), `function_missing` (`PGRST202`/`42883`), `protocol` (an unexpected return value), `clock` (the database rejected `occurred_at`).

## 5. Fail-closed behaviour

| Situation | Behaviour |
|---|---|
| `mode=strict` but credentials, writer id or config invalid | refuse before screening completes work: no provider call; startup self-check reports a closed code |
| Attempt not acknowledged (unacked or hard) | **no provider request**; caller gets a fixed message with no detail; counter incremented |
| Provider fails | `provider_failed` recorded (best-effort); safe provider error returned as today |
| Outcome or archive event not acknowledged | results **still returned**, flagged `ledger_degraded` with closed reason codes; reconciliation will show the gap |
| Redaction unverifiable | nothing stored, response withheld (Correction 6 unchanged); `sanitization_failed` and `output_withheld` recorded best-effort |
| Rejection event not recorded | the rejection is returned regardless (no provider call happened); a counter records the lost audit event (decision W4) |
| Ledger database down for a long time | strict mode refuses every provider call until it recovers or the Founder switches the mode (availability traded for the audit guarantee; decision W9) |

## 6. Event construction (what each field is derived from; nothing free-form)

| Event | Field | Source and rule |
|---|---|---|
| all | `event_id` | `crypto.randomUUID()` once per event, reused on retry |
| all | `retrieval_id`, `seq` | minted by the run; `seq` increments only when an event is created |
| all | `phase`, `event_type`, `schema_version` | fixed mapping from the doctrine; `tpig-ledger-1` |
| all | `writer_id`, `app_version` | configured opaque tokens (pattern `^[a-z0-9_-]{1,40}$` and `^[0-9A-Za-z._+-]{1,40}$`, never a 32-hex run, never a hostname) |
| all | `occurred_at` | `new Date().toISOString()` at creation (UTC, milliseconds, `Z`) |
| all | `row_hash` | canonical hash (section 7) |
| `query_rejected` | `provider`, `engine`?, `query_policy`, `rejected_field`, `reason_codes` | from `PolicyViolation` (`field`, sorted unique `reasons`); both vocabularies already equal the database allowlists |
| `provider_attempt` | `provider`, `engine`, `query_policy` | `serpapi`; the screened engine; `QUERY_POLICY_VERSION` |
| | `param_names` | sorted (C collation) names actually sent, from `q` or `search_query`, `location`, `geo`, `date`, `data_type`, `num`; **names only** |
| | `query_length` | length of the screened query (1-256); **not** the text |
| | `has_location`, `save_requested`, `data_type`?, `num_requested`? | booleans and enums from validated inputs |
| `provider_succeeded` | `provider`, `engine`, `result_count` | item count of the engine's result array (or 0/1 for an object result) |
| | `served_from_cache` | **omitted** until a verified source exists (decision W7); never guessed |
| `provider_failed` | `provider`, `engine`, `error_code` | `http_NNN` for a 100-599 status; `timeout`; `network`; `provider_error` for a 200 with an error body |
| `archive_succeeded` | `artifact_uuid`, `artifact_hash`, `sanitize_policy` | from `saveRawSignal`'s result; policy `tpig-sanitize-2` |
| `archive_failed` | `error_code`, `sanitize_policy` | `archive_write`, `archive_mirror` or `archive_unknown` (needs typed errors from the store, section 12) |
| `sanitization_failed` | `stage`, `sanitize_policy` | `SanitizationFailure.stage` (already one of `params`, `response`, `title`, `archive-body`, `output`, `log-event`) |
| `output_withheld` | `sanitize_policy`, `stage` | `output` |

`retention_exception` is never built by the writer, and the function refuses it.

## 7. Canonical hash

The writer computes `row_hash` itself: `sha256` (hex) of the UTF-8 string made by joining the 30 fields in the doctrine's fixed order with `\x1f`; null as the empty string, booleans `true`/`false`, arrays comma-joined (already sorted, unique), `occurred_at` as the millisecond UTC string. **Known-answer vector** (computed independently of both the database and the writer; the same fixture the database test suite already matches): the `provider_attempt` fixture used in `scripts/local-test/run.sh` hashes to `b582a3d4c8d473783862df49e25b3696087e1e1e7fa1e7f68b5b42366aeb0f0a`. The database verifies the hash on every insert, so any drift fails loudly instead of silently.

## 8. Transaction boundaries, partial failure and recovery

- **The only atomic unit is one event row**: each call to the append function is its own database transaction. There is no transaction across a provider call (impossible), and none across "write artifact, then record the event".
- **Crash and failure windows** (all visible to reconciliation; none needs local recovery state):

| Window | Result in the ledger | Reconciliation issue |
|---|---|---|
| after the attempt is acknowledged, before the provider answers (crash, kill) | attempt only | `incomplete_retrieval` |
| provider answered, `provider_succeeded` not recorded | attempt only | `incomplete_retrieval` |
| `provider_succeeded` recorded, archive requested, nothing further recorded | attempt, succeeded | `archive_outcome_missing` |
| artifact stored, `archive_succeeded` not recorded | attempt, succeeded | `archive_outcome_missing` and `artifact_without_ledger` |
| an event in the middle of a retrieval was lost | a hole in `seq` | `sequence_gap` |
| two outcomes recorded for one retrieval | both rows | `conflicting_outcomes` |

- **Recovery is human and read-only first.** `scripts/ledger-reconcile.ts` (service-role `SELECT` of the reconciliation view) prints counts per issue and 8-character id prefixes, and exits non-zero on anything except `pre_ledger_artifact`. Resolving an incomplete retrieval is a Founder decision; the schema has no "abandoned" event, and adding one would be a new migration (not proposed here).
- **A local-only artifact** (local file written, Supabase mirror failed) is invisible to the view, which reads `thq_artifacts`. That is today's behaviour; the `archive_failed` / `archive_mirror` event is the ledger's record of it.

## 9. Safe error handling

- The client reads **only** the HTTP status and the SQLSTATE `code` of a failed call. It **never reads, logs or forwards** `message`, `details` or `hint` (they can echo values). Mapping: `23000` conflict, `23505` seq_conflict, `23514` validation, `42501` permission, `PGRST202`/`42883` function_missing, 401/403 auth, 429 rate_limited (retry), 5xx server (retry), `AbortError` timeout (retry), a fetch `TypeError` network (retry), a successful call returning anything other than `inserted`/`duplicate` protocol (hard), anything else unknown (retry, then unacked).
- Every log line and counter uses **closed codes only**. The writer does not use the existing `console.error(... error.message)` helpers in `supabase.ts`, which print database messages; those paths remain a separate, pre-existing risk (section 16).
- Callers receive fixed, content-free messages (`ledger unavailable ...`, `ledger_degraded: true` with closed codes).

## 10. Telemetry (no raw queries, secrets or URLs)

Process-local counters, reset on restart, exposed in each tool response as `ledger: { mode, attempt, degraded, degraded_codes }` and (decision W6) optionally through a read-only `ledger_status` tool:

| Counter | Meaning |
|---|---|
| `attempts_acked`, `attempts_refused`, `attempts_refused_hard` | pre-provider outcomes |
| `events_ok`, `events_duplicate`, `events_failed` by closed class | write results |
| `conflicts`, `validation_failures` | alert-grade (bug or drift) |
| `retries` and a latency histogram (buckets only) for append calls | cost and health |
| `degraded_responses`, `rejections_recorded`, `rejections_lost` | quality of the audit trail |

Allowed content: counts, closed codes, durations. Forbidden everywhere in telemetry: query text, location text, URLs, provider messages, database messages, keys, full artifact ids (prefix only), full retrieval ids in logs (prefix only).

## 11. Concurrency

- Independent retrievals run in parallel with their own `retrieval_id` and `seq`; the database enforces `(retrieval_id, seq)` and `event_id` uniqueness.
- Within one retrieval every write is awaited in order, so `seq` is strictly increasing and the attempt is acknowledged before the provider is called.
- Two BLUME processes (or machines) need distinct `writer_id` values; `retrieval_id` collisions are not a practical concern (random uuid).
- A late acknowledgement for an attempt that has already timed out and been retried is harmless: the second send returns `duplicate`.

## 12. Exact file-change plan

**New (all under `blume`):**

| File | Purpose |
|---|---|
| `src/signals/ledger/types.ts` | closed enums mirroring the database allowlists; event type per kind |
| `src/signals/ledger/canonical.ts` | `rowHash(event)` per the doctrine |
| `src/signals/ledger/events.ts` | typed builders per event type (allowlist, local matrix check, frozen result) |
| `src/signals/ledger/client.ts` | `LedgerClient` interface; `SupabaseLedgerClient` (`rpc`, `abortSignal`, SQLSTATE and status mapping, never reads messages) |
| `src/signals/ledger/writer.ts` | `RetrievalRun`: ack-required attempt, best-effort outcomes, retry policy, degraded state |
| `src/signals/ledger/telemetry.ts` | counters and histogram buckets |
| `src/signals/ledger/config.ts` | mode, writer id, timeouts, retries, validation |
| `scripts/ledger-reconcile.ts` | read-only reconciliation report |
| `test/ledger/*.test.ts` | unit, flow, concurrency and privacy suites (section 14) |
| `test/ledger/contract/` | optional local-PostgreSQL contract suite (decision W8) |
| `docs/runbooks/ledger-operations.md` | modes, break-glass, reconciliation, alert meanings |

**Modified:**

| File | Change |
|---|---|
| `src/signals/sources/serp.ts` | mint the run before screening; emit events at each stage; no change to behaviour when `mode=off` |
| `src/signals/envelope.ts` | split `recordRetrieval` so archiving is a separate step returning a typed result; `logSignalEvent` becomes a shim (legacy JSONL only in `off` mode, in-memory telemetry in `strict`) |
| `src/signals/policy.ts` | `ProviderError` gains a closed `ledgerCode` (`http_NNN` / `timeout` / `network` / `provider_error`) |
| `src/artifacts/store.ts` | throw typed `ArtifactWriteError` / `ArtifactMirrorError` (guards and write-once behaviour unchanged) |
| `src/mcp/server.ts` | include the `ledger` object and `retrieval_id` in signal tool output |
| `src/config.ts` | ledger configuration |
| `package.json` | test glob includes `test/ledger`; `ledger:reconcile` script |
| `docs/boundaries.md`, `docs/doctrine/tpig-retrieval-ledger.md` | pointers |

**Not modified:** the deployed migration, `revenue-core-infra`, the raw-signal guards, the Correction 6 enforcement logic (only wired to), and the legacy `vaults/_signals/retrieval-log.jsonl` file.

## 13. Implementation sequence (each step gated; none is authorized yet)

1. Founder decisions below.
2. `types`, `canonical` (known-answer test), `events` (matrix tests), pure and offline.
3. `client` and `writer` with a fake database that models the deployed semantics.
4. Flow wiring behind `mode=off` (existing 109 tests stay green; no behaviour change).
5. Telemetry and `ledger-reconcile`.
6. Local-PostgreSQL contract suite against the real function.
7. Mutation testing of the writer, review, commit and push.
8. **Activation** (`strict`) only on a separate written authorization, with a read-only post-activation check and an evidence file; the first live retrieval would be a separate approved step because it calls the provider.

## 14. Test design (all mocked; the contract suite uses an isolated local PostgreSQL only)

**Seams:** `LedgerClient` (fake implementations: scripted responses, delays, commit-then-timeout, and an in-memory model of the deployed function: `event_id` uniqueness with hash comparison, `(retrieval_id, seq)` uniqueness, closed SQLSTATE codes); the provider (`axios.get` stub, as today); an injectable clock and uuid source.

| ID | Group | Cases |
|---|---|---|
| C1-C6 | Canonical hash | known-answer vector; null/empty handling; array sorting; timestamp format; booleans; changing any single field changes the hash |
| B1-B8 | Builders | every event type satisfies the required/forbidden matrix; property test: random inputs never yield a field outside the allowlist; `param_names` per engine; reason-code and error-code mapping (including 99 and 600 as `provider_error`); bounds; writer-id and version patterns (32-hex refused); serialized events never contain the query, location, URLs or key patterns |
| K1-K7 | Client | `inserted`/`duplicate` parsed; each SQLSTATE and status mapped; a poisoned `message`/`details`/`hint` containing a marker never reaches telemetry, logs or callers; abort timeout; network error; unexpected return value is protocol; call shape is `{ p: event }` |
| W1-W13 | Writer | acked first try; retry after network error; commit-then-timeout then `duplicate` is acked; unacked after retries refuses (provider mock call count 0); each HARD class not retried; conflict is hard; outcome unacked sets degraded and results still return; `seq` order and the gap after a lost middle event; `off` makes no calls; strict with bad credentials or writer id refuses; clock rejection handled; frozen payload on retry (same id and hash) |
| F1-F12 | Flows (mocked provider plus fake database) | normal unsaved; saved (artifact uuid and hash match the stored artifact); provider 401, 429, 500, timeout, network, and a 200 with an error body each give `provider_failed` with the right code and no archive; PII or credential query gives only `query_rejected` with codes, no provider call, no text, no hash; sanitization fault gives `sanitization_failed` then `output_withheld` and no data; archive local-write failure; mirror failure (typed error); artifact stored but `archive_succeeded` unacked (degraded; reconciliation expectation modelled); database down at attempt (provider count 0); up at attempt, down for outcomes (results with `ledger_degraded`); trends and serp parity |
| N1-N5 | Concurrency | 50 parallel retrievals (unique ids, contiguous `seq` each, consistent rows); interleaved slow and fast database; the same `event_id` sent twice concurrently (one inserted, one duplicate); two writers with different `writer_id`; a late acknowledgement after timeout and retry |
| P1-P6 | Privacy and regression | no event, log line or counter holds query text, URLs or keys; closed `degraded_codes` only; the existing 109 Correction 6 tests unchanged and green; raw-signal write-once and reserved-scope guards intact |
| L1-L6 | Contract (local PostgreSQL, real function) | each of the 9 event types built by the writer is accepted by the real function and triggers; JS hash equals the database hash; a conflicting duplicate raises `23000` and maps to `conflict`; a reused seq raises `23505`; a deliberate allowlist violation maps to `validation`; a complete flow leaves no reconciliation issue, and each interrupted flow produces its expected issue |
| M | Mutation | the same harness style as the migration: remove the attempt-ack requirement, the retry, the idempotent reuse of `event_id`, the HARD classification of conflicts, the message-ignoring rule, the degraded flag, the `seq` ordering, the allowlist check in builders; each mutant must fail the suite |

## 15. Founder decisions required

| # | Decision | Recommendation |
|---|---|---|
| W1 | Activation: ship the writer with `BLUME_LEDGER_MODE=off` as the default and activate `strict` only on separate written approval | Yes |
| W2 | Latency: the deployed function takes one event per call, so a saved retrieval makes 3 sequential calls (about 0.3-0.5 s added). Accept that, or later add a batch function through a new migration (not proposed now) | Accept for now |
| W3 | When an outcome event cannot be recorded, still archive the artifact (paid-for data, reconciliation reports `artifact_without_ledger`), or skip archiving to keep "no artifact without a ledger record" | Still archive, flag `ledger_degraded` |
| W4 | A rejection event that cannot be written: return the rejection anyway and count the lost audit event, or fail the call differently | Return anyway, count it |
| W5 | Timeouts and retries: attempt 5 s with 2 retries (worst case about 16 s before refusing); outcomes 3 s with 1 retry | As stated |
| W6 | Telemetry exposure: `ledger` object in each response plus CLI reconcile only, or also a read-only `ledger_status` MCP tool | Response object and CLI first |
| W7 | `served_from_cache`: omit until a verified source exists (docs reachable here do not define one; a one-time approved live observation could settle it, which would be a provider call) | Omit now |
| W8 | Add the local-PostgreSQL contract suite (real function, isolated, no production) | Yes |
| W9 | Break-glass when the ledger database is down for long: document "set mode off and restart" (an explicit, recorded decision) versus no bypass | Document it, Founder-only, evidence-recorded |
| W10 | `writer_id`: required in strict mode with no default (for example `blume-desktop`); distinct per machine | Required |
| W11 | Existing Correction 6 JSONL log: keep it only in `off` mode, write nothing to disk in `strict` (D10), leave the 4-line legacy file untouched, delete nothing | As stated |
| W12 | Reconciliation scheduling: manual CLI now; a scheduled job later (separate approval) | Manual now |

## 16. Risks

1. **Canonical drift between the TypeScript and SQL implementations.** Mitigated by the known-answer vector, a database that verifies every hash, and the contract suite (L2).
2. **Availability.** Strict mode makes the ledger a hard dependency for provider calls (W9).
3. **Latency** from sequential single-event calls (W2).
4. **Allowlist drift** between the builders and a future schema version: the contract suite and `validation` classification surface it immediately.
5. **Pre-existing error-echo paths** in `supabase.ts` (`console.error(... error.message)`) can print database messages for other tables; the writer avoids them, but they are outside this change.
6. **Local-only artifacts** (mirror failure) are invisible to reconciliation (section 8).
7. **Clock skew**: the database rejects an `occurred_at` more than a day ahead or before 2026; classified `clock` and surfaced.
8. **Unsourced `served_from_cache`** (W7).
9. **The first live retrieval after activation is a real provider call** and a real ledger write; it needs its own approval and evidence.
10. **O3 and O5 remain open** (backups, retention): the ledger is a launch blocker until resolved.

## 17. Out of scope for this phase

Writing code, activating the writer, any provider call, importing legacy JSONL, deleting anything, changing the deployed migration, batch or abandonment events (new migrations), scheduled reconciliation.
