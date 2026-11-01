# TPIG Retrieval Ledger: Operations Runbook

**Status:** the writer is IMPLEMENTED and tested locally. It ships **off by default** (`BLUME_LEDGER_MODE` unset). Strict mode has NOT been activated; activation is a Founder decision (see "Activation prerequisites").
**Design:** `docs/doctrine/tpig-retrieval-ledger-writer-design.md` · **Doctrine:** `docs/doctrine/tpig-retrieval-ledger.md`
**Write path:** only the deployed `public.thq_append_retrieval_event` RPC. No direct inserts, no outbox, no local JSONL mirror in strict mode.

## 1. Modes

| `BLUME_LEDGER_MODE` | Behaviour |
|---|---|
| unset or `off` | Default. Writer does nothing; retrieval behaviour and output are exactly as before the ledger existed. |
| `strict` | The `provider_attempt` event must be durably acknowledged **before** any provider network call. If it cannot be, the retrieval is refused (no provider request is made). |
| anything else | Treated as strict **and invalid**: every retrieval is refused (`ledger_config_invalid`). An unrecognised value never means off. |

**There is no automatic strict-to-off fallback.** Once a process resolves strict, the mode is latched until restart. Database outage, invalid settings or repeated errors can only cause refusals. Switching to off is a Founder-only action: change the setting and restart the process.

## 2. Required settings in strict mode

| Variable | Rule |
|---|---|
| `BLUME_LEDGER_MODE` | `strict` |
| `BLUME_WRITER_ID` | required; `^[a-z0-9_-]{1,40}$`, no run of 32 hex characters; identifies this deployment in every row |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | service role of the project that holds the deployed migration |
| `BLUME_LEDGER_ATTEMPT_TIMEOUT_MS` / `_RETRIES` | default 5000 / 2 (range 500-30000 / 0-5) |
| `BLUME_LEDGER_OUTCOME_TIMEOUT_MS` / `_RETRIES` | default 3000 / 1 (same ranges) |

A missing or invalid value refuses retrievals with a closed code; it never degrades to off. Never put key values in tickets, chat or logs.

### Startup line

The MCP server prints one line to stderr at startup, for example `retrieval ledger: mode=strict valid writer=blume-prod`. `mode=off` means no ledger events are written (also what a missing `.env` or wrong working directory produces). `mode=strict INVALID reason=...` means every retrieval is refused. `WARNING NODE_ENV=test` means test seams are on and Supabase is disabled: never run production that way. Set the mode in the launcher's own environment and always check this line after a restart.

## 3. What callers see

- Attempt not acknowledged: error code `ledger_unavailable` (transient), `ledger_refused_hard` (conflict, validation, permission, auth, missing function) or `ledger_config_invalid`. Fixed messages; no detail. No provider request was made.
- Outcome or archive event not acknowledged **after** an acknowledged attempt: results are still returned with `ledger: { mode, attempt, degraded: true, degraded_codes: [...] }`. Codes look like `archive_succeeded:timeout`.
- Healthy strict responses carry `ledger: { mode: "strict", attempt: "acked", degraded: false, degraded_codes: [] }`.

## 4. Retry rules

An event is built once and deep-frozen. Every retry resends the **identical** event (same `event_id`, `occurred_at`, `row_hash`), so a lost acknowledgement is answered `duplicate`, never a second row. HARD classes (`conflict`, `seq_conflict`, `validation`, `permission`, `auth`, `function_missing`, `protocol`) are never retried. Retries are bounded by the settings above.

## 5. Reconciliation

`npm run ledger:reconcile` reads `public.thq_retrieval_reconciliation` (SELECT only) and prints issue names, counts and 8-character id prefixes. It changes nothing.

Exit status: `0` nothing actionable (only informational `pre_ledger_artifact`), `1` actionable issues, `2` could not read (credentials missing or query failed; details withheld).

| Issue | Meaning | Typical cause |
|---|---|---|
| `archive_outcome_missing` | an artifact was requested but no archive outcome exists | degraded outcome write, crash between provider success and archive |
| `artifact_without_ledger` | an artifact exists with no ledger event | archive write acknowledged nowhere (refinement 2: kept detectable on purpose) |
| `orphan_artifact_reference`, `artifact_hash_mismatch` | ledger and archive disagree | investigate; never auto-repair |
| `incomplete_retrieval`, `sequence_gap`, `outcome_without_attempt`, `conflicting_outcomes` | event stream defects | degraded writes, bugs |
| `row_hash_mismatch` | row hash does not recompute | tampering or writer bug: treat as an incident |
| `pre_ledger_artifact` | predates the ledger | informational; legacy records are NOT imported |

Discrepancies are reported, never silently resolved. Resolution is a human decision.

## 6. Telemetry (process-local, closed vocabulary)

Counters: `attempts_acked`, `attempts_refused`, `attempts_refused_hard`, `events_ok`, `events_duplicate`, `events_failed`, `conflicts`, `validation_failures`, `retries`, `degraded_responses`, `rejections_recorded`, `rejections_lost`, `config_refusals`; per-failure-class counts; latency buckets. Alert on: any `conflicts`, any `validation_failures`, any `config_refusals`, sustained `attempts_refused`, any `row_hash_mismatch` in reconciliation.

Telemetry never contains queries, locations, URLs, keys, provider messages or database error text.

## 7. Break-glass

Only the Founder decides to leave strict mode: set `BLUME_LEDGER_MODE=off` (or unset) and restart. The code never does this itself. Record the reason and time; run reconciliation after restoring strict.

## 8. Tests

- `npm test` : mocked unit, lifecycle, privacy, concurrency, failure suites plus all Correction 6 regression tests.
- `npm run test:ledger-contract` : starts a throwaway local PostgreSQL, applies the **deployed** migration from `revenue-core-infra`, and runs the real lifecycle against the real function. Never touches Supabase or any network.
- `python test/ledger/mutation/mutations.py` : 26 writer mutants plus a control; every mutant must be killed.
