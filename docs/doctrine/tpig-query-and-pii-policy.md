# TPIG Query & PII Policy

**Status:** Ratified conditionally by the Founder, 2026-10-31 (Correction 6)
**Policy versions:** `tpig-query-policy-1` (what may be sent) · `tpig-sanitize-2` (what may be stored, logged or returned)
**Owner:** BLUME owns the canonical implementation policy, under TPIG governance (TPIG v1.0 remains provisional above it)
**Enforcement:** `src/signals/policy.ts`, wired through `src/signals/sources/serp.ts`, `src/signals/envelope.ts` and `src/mcp/server.ts`
**Tests:** `test/signals/*.test.ts` (`npm test`; mocked, no network, no database, no live provider calls)

Change control: changing a rule here, or a detector in `policy.ts`, requires a new policy version and Founder ratification. There is no runtime override flag.

## 1. Scope

Applies to every retrieval of external public signals through a provider adapter (currently SerpAPI: Google web, events, maps, YouTube, news, Trends), and to everything derived from it: stored raw signals, titles, params, retrieval logs, MCP responses, and read-backs of historical records.

## 2. Query data

**Permitted:** public-topic text: topics, brands, products, public-event names, dates, and places at city, region or country level.

**Prohibited in any provider parameter (`q`, `location`, `geo`, `date`, and any future parameter):**

| Class | Reason code | Detection |
|---|---|---|
| Email address | `email` | pattern |
| Phone number | `phone` | US formats, `+` E.164 contiguous, bare 10 digits |
| Government identifier | `national_id` | US SSN format |
| Payment card | `payment_card` | 13 to 19 digits, Luhn-valid |
| Bank account (IBAN) | `iban` | pattern plus mod-97 check |
| Street-level address | `street_address` | house number plus street suffix (see 2.2), PO box |
| Credential or secret | `credential` | known key shapes, `name=value` pairs, 64-hex strings, any secret this process holds |
| Tokenized URL | `tokenized_url` | URL with userinfo, token-like query parameters, or a provider capability URL |
| Wrong type, empty, over length, control characters, malformed `geo`/`date`/enum | `invalid_type`, `empty`, `too_long`, `control_characters`, `invalid_format` | validation |

**2.1 Private individuals.** A query about a private individual is prohibited. It is enforced by human-approved use, not by this module: the module cannot recognise a name or a personal narrative (D1, documented limitation). Queries about public figures, public organisations and public events are permitted.

**2.2 Street addresses.** In `q`, an address-shaped run (house number, one to four words, street suffix) is rejected only when it ends the query or is followed by a comma, a unit marker or a ZIP code. This keeps "10 best street food in austin" and "10 best road trips in texas" legitimate. In `location`, which must be a city, region or country, any house-number-plus-suffix run is rejected.

**2.3 Location and geo (D5).** Approved for the current public-topic search workflow: `location` is free text at city/region/country level and is screened in locality mode; `geo` must be a region code (`US`, `US-TX`); Trends `date` must be one of the documented forms.

## 3. Rejection behaviour (fail closed)

- Screening runs on **every** provider entry point, **before** any network request, including optional parameters.
- A violation rejects the whole call. Nothing is sent, stored or returned. There is no override.
- The error names the field and reason codes only, never the text.
- A rejection is logged as `query_rejected` with: time, provider, engine, field, reason codes, policy version. **No query text and no query hash** (D4).

## 4. Redaction (`tpig-sanitize-2`)

Applied wherever provider data or caller text could be persisted or shown: stored responses and params, titles, retrieval-log events, tool output, provider errors, and MCP read responses.

- Provider capability URLs (`serpapi.com/searches/...`) anywhere in a string become `[REDACTED:provider-capability-url]`.
- Credential shapes, `name=value` secrets, URL token parameters, sensitive object keys (`api_key`, `token`, `secret`, `password`, `authorization`) and any secret this process holds become `[REDACTED:credential]`.
- Redaction is idempotent and does not alter ordinary text or non-secret hashes.

## 5. Verification (fail closed)

After redaction, a second independent pass must find nothing left to redact. If it does, or redaction itself errors:

- the archive is not written (nothing is stored);
- the log line is replaced by a content-free `log_suppressed` marker;
- **the response is withheld**: a failed sanitization never makes the unsanitized response safe to return. The caller receives `withheld: true` and a retrieval id, with no provider data;
- the event is logged as `sanitization_failed` with no content.

## 6. Raw versus sanitized

The stored artifact is the sanitized representation. The pre-sanitization sha256 and the redacted paths are recorded in the envelope. Raw provider bytes are never stored. Each record carries the `sanitization_policy` it was written under. Existing records are immutable: `tpig-sanitize-1` records and the pre-policy `tpig-raw-0` record are never rewritten.

## 7. Provider errors

A caller-visible provider error contains the provider name, an HTTP status or code, and, only when it is provably clean, the provider's own short message. The provider message is dropped if redaction changes it, a residual check flags it, it contains a prohibited identifier, it exceeds 200 characters, or it contains any value the caller supplied (a provider echoing the query). The thrown object is never the original transport error, which carries the request URL and key.

## 8. Logging

- Only screened parameters are logged. The API key is never in a logged parameter.
- Every event is redacted and verified before it is written (section 5).
- Durability, shipping and retention of the retrieval log belong to Correction 5 (durable retrieval ledger), not to this policy.

## 9. Retention and deletion

- Raw signals are immutable. A raw signal is deleted only by an approved retention migration in `revenue-core-infra`, with its reason set transaction-locally (see migration `20261031055000`) and an evidence file.
- Any local copy of a raw signal is removed only under the local retention procedure (`docs/procedures/local-raw-signal-retention.md`), separately authorized, and recorded in an evidence file.
- Retention periods by signal category remain a TPIG open question and are not decided here.
- Retention and deletion are never bundled into ordinary implementation work.

## 10. Historical records and MCP reads (D3)

`artifact_get` and `artifact_list` pass raw-signal artifacts through `redactArtifactForRead`:

- the stored record is never mutated and its recorded `hash` is not changed;
- the returned copy reports `read_redacted` and `read_redaction_count`; its `hash` field still describes the stored body, not the redacted one;
- if the redacted copy cannot be verified clean, the body is replaced by `[WITHHELD:redaction-unverified]`;
- non-raw-signal artifacts are returned unchanged.

`vault_search` reads legacy vault entries, not TPIG raw signals, and is out of scope for this policy.

## 11. External providers

A provider adapter must: screen every parameter before sending; build its params internally from screened values; keep credentials in BLUME configuration only (never in params, logs, artifacts or errors); declare its capability-URL shape so redaction recognises it; and return only sanitized data to callers. A provider without these properties is not callable.

## 12. Audit evidence

Every rejection, sanitization failure and retrieval is logged. Every retention action produces an evidence file (counts and masked identifiers only). Policy or detector changes ship with tests in the same commit.

## 13. Documented detection limits

Detection is pattern-based and best-effort. It will not catch:

- a private individual's name or personal narrative in free text;
- international phone numbers written with spaces (`+44 20 7946 0958`);
- payment-card-like numbers that fail the Luhn check;
- addresses that are not in the house-number-plus-suffix form, or that use suffixes outside the supported list;
- secrets with no recognisable shape.

It will reject some legitimate queries:

- address-shaped public landmarks (`1600 pennsylvania avenue`);
- queries that happen to end in a house-number-plus-street-word pattern (`highway 101 california coast drive`);
- queries containing a `name: value` pair that looks like a secret (`token: abc12345`);
- any 10-digit number.

A rejected legitimate query is rephrased by the caller. Widening or narrowing a detector is a policy change (section header, change control).

## 14. Deferred

DB-level enforcement (a trigger that rejects capability URLs on insert into `thq_artifacts`) is deferred pending separate review (D7). Rate limiting (TPIG section 9) and the durable retrieval ledger are separate work.
