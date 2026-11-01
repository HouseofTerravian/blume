# Retrieval Ledger Writer: Pre-Activation Security Gate

**Date:** 2026-10-31 · **Subject:** BLUME `3f00889` · **Scope:** local code and isolated tests only. No production write, strict activation, live provider call, legacy import or deletion occurred. The deployed migration (`revenue-core-infra` `487595f`) was not touched.

## Verdict

**Code: GO.** No Critical or High finding. Three Medium findings were fixed and test-locked.
**Activation: HOLD** until the Founder completes the prerequisites in section 5. Nothing here activates strict mode.

## 1. Findings

| # | Severity | Finding | Evidence | Remediation |
|---|---|---|---|---|
| F1 | Medium | The acknowledged-attempt rule was enforced only by call order in `serp.ts`. `fetchSerp` (the single `axios.get` to the provider) had no proof of its own that an attempt was acknowledged, so a future edit that skipped or ignored `run.attempt()` would reach the network silently. No present path bypassed it: only `serpSearch` and `trendsSearch` call `fetchSerp`, and the MCP server calls only those. | `grep` of `src/` for `serpapi`/`axios`: one provider egress; mutant M13 killed. | `RetrievalRun.assertProviderAllowed()` is called first inside `fetchSerp`, which now requires the run: strict mode throws unless THIS run's attempt was acknowledged (config invalid or pending also throw). Tests A1-A4b; mutants M27, M28. |
| F2 | Medium | Tests were not hermetic by construction. `restoreProvider()` restored the real `axios.get`, and `getSupabase()` would build a real client from any production credentials in the environment. Both setup files blanked the variables, but a test missing the setup import (or a stray exported variable) would reach the live provider or database. | `test/*/support.ts` `realGet`; `src/integrations/supabase.ts` before the change. | `test/hermetic.ts` (imported first by both setups): NODE_ENV=test, credentials blanked, axios default adapter and global `fetch` throw. `getSupabase()` returns null under NODE_ENV=test unless a test injected a client. Tests A9, A10; mutant M29. |
| F3 | Medium | A strict deployment can resolve to **off with no signal** if the process is launched where `.env` is not found (the MCP launcher's working directory) or the variable is absent. | `src/config.ts` loads `dotenv` from the working directory; `resolveLedgerConfig` treats unset as off by design. | `ledgerStartupNotice()` prints the resolved mode (and writer id, or the invalid reason) to stderr at MCP startup, and flags NODE_ENV=test. Test A8; mutant M31. Residual: see section 4 (an operator must read the line). |
| F4 | Low | Test seams (`__set...ForTests`, `__reset...`) are guarded only by `NODE_ENV=test`. Production code never calls them and no MCP tool exposes them; setting NODE_ENV=test in production would also disable Supabase. | grep of `src/`; A10 proves all four refuse otherwise. | Startup notice warns when NODE_ENV=test. Accepted; same trust level as the ability to set the mode itself. |
| F5 | Low | Mutants M05, M09, M20, M25 looked timeout-only. They are not: each is killed by 2-8 assertion failures (W5/W6/F17/W15, W9/W18/W19/events, K2/K3, B1 x8) plus one secondary hang in `writer.test.ts` that the mutation causes. M16 (deadline removed) WAS hang-only. | harness now prints assertion vs timeout failure counts per mutant. | W7 now races the call against a 4 s timer and fails by assertion. M16 killed by assertion. Harness time-out per test is 20 s. |
| F6 | Low | After a writer deadline fires, the abandoned call may still commit later. An identical retry then answers `duplicate`, but a later event may land first, so reconciliation can show a transient `sequence_gap` that clears when the late write lands. | N5 and N6 tests. | Accepted: detectable, never silent, no data loss. |
| F7 | Low | An uncertainly committed attempt that is never acknowledged leaves one attempt row with no provider call. | A4. | Accepted by design: shows as `incomplete_retrieval`; the provider was not called. |
| F8 | Low | `save_error` in responses can carry a local filesystem message (already passed through `safeSaveError`, Correction 6) and could include a vault path. Pre-existing; not a secret. | `envelope.ts` `recordRetrieval`. | No change. |
| F9 | Info | `blume_analyze_site` (`src/content/analyzer.ts`) performs an outbound `axios.get(url)` for caller-supplied URLs. It is not the SerpAPI provider and is outside this ledger's scope (and an SSRF-style surface for its own review). | `grep axios`. | Out of scope; flagged for a separate decision. |

Checked and found sound: RPC classification reads only HTTP status and SQLSTATE (K2/K3, P1/P2 with poisoned message/details/hint); hard classes never retry (M05, M19, M20); invalid or unknown mode values fail closed (A5: Strict, STRICT, on, true, 1, OFF, false, ... all refuse); the latch holds against env changes in a running process (A6); writer ids that could carry data are refused (A7); duplicate acknowledgement and lost-ack retry are idempotent (N3, N5, contract suite); sequencing under 50-way concurrency and random failures holds (N1, N2, N6); privacy across ledger rows, telemetry, console, thrown errors and responses holds (P1-P6); off mode output is unchanged (modeoff tests and the 109 original signals tests).

## 2. Remediation commit

Source: `ledger/writer.ts` (`assertProviderAllowed`), `sources/serp.ts` (`fetchSerp(run, ...)`), `integrations/supabase.ts` (test-mode client guard), `ledger/index.ts` (`ledgerStartupNotice`), `mcp/server.ts` (prints it). Tests: `test/hermetic.ts`, `test/ledger/adversarial.test.ts` (A1-A10), W7 hardened, mutants M27-M31 added.

## 3. Final test results

TypeScript clean. Full regression 255/255 (109 original signals tests unchanged, ledger suites, adversarial A1-A10). PostgreSQL contract L1-L7 7/7 against the deployed migration on a throwaway local cluster. Mutation: 31 mutants plus an identity control, 31 killed, 0 survived.

## 4. Remaining risks

- Strict mode refuses all provider calls while the ledger database is unavailable (ratified, W9).
- The startup line must be read by an operator; there is no hard "require strict" assertion. Recommended activation step 4 closes this by checking the line.
- Break-glass is a restart with the mode unset: anyone able to change the process environment can downgrade. This is the Founder-only control and is detectable (startup line, reconciliation gaps), not preventable in code.
- Contract tests ran on local PostgreSQL 18.6; production is 17.6.
- The mutation set is hand-picked, not exhaustive.

## 5. Activation prerequisites (Founder-executed)

1. Review and accept this audit and the commit that carries it.
2. Choose `BLUME_WRITER_ID` (`^[a-z0-9_-]{1,40}$`); deliver service credentials by the temp-file handoff (Rule 23), never in chat.
3. Set `BLUME_LEDGER_MODE=strict` in the environment of the MCP launcher itself (not only in a `.env` that depends on the working directory).
4. Start the server and confirm stderr shows `retrieval ledger: mode=strict valid writer=<id>`; if it shows `mode=off` or `INVALID`, stop.
5. Make ONE supervised retrieval, then run `npm run ledger:reconcile`; expect exit 0.
6. Keep break-glass (unset mode + restart) Founder-only.
