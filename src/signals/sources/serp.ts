// SerpAPI source — https://serpapi.com/search-api
// Engines: google (web), google_events, google_maps, youtube, google_news.
//
// Policy: every parameter is screened (tpig-query-policy-1) BEFORE any network request, provider errors are
// reduced to caller-safe text, and everything returned to the caller is built from the verified sanitized
// response (tpig-sanitize-2). See docs/doctrine/tpig-query-and-pii-policy.md.
//
// Retrieval ledger (docs/doctrine/tpig-retrieval-ledger-writer-design.md): each retrieval gets a RetrievalRun. In strict mode
// the provider_attempt must be durably acknowledged BEFORE the provider is called; in off mode (the default) the run is inert
// and nothing below changes.

import axios from "axios";
import { config } from "../../config.js";
import { MAX_RESULTS, logSignalEvent, recordRetrieval } from "../envelope.js";
import { beginRetrieval, type RetrievalRun, type RunSummary } from "../ledger/index.js";
import type { Engine, ReasonCode, RejectedField } from "../ledger/types.js";
import {
  PolicyViolation,
  ProviderError,
  MAX_LOCATION_LENGTH,
  MAX_QUERY_LENGTH,
  QUERY_POLICY_VERSION,
  safeProviderError,
  sanitizeStructure,
  screenEnum,
  screenGeo,
  screenText,
  screenTrendsDate,
} from "../policy.js";

export const SERP_ENGINES = ["google", "google_events", "google_maps", "youtube", "google_news"] as const;
export type SerpEngine = (typeof SERP_ENGINES)[number];

export const TRENDS_DATA_TYPES = ["TIMESERIES", "GEO_MAP", "RELATED_QUERIES", "RELATED_TOPICS"] as const;
export type TrendsDataType = (typeof TRENDS_DATA_TYPES)[number];

/** Caller-supplied values are `unknown` on purpose: they are validated here, not trusted from the type system. */
export interface SerpQuery {
  engine?: unknown;
  q: unknown;
  location?: unknown;
  num?: unknown;
  save?: boolean;
}

export interface TrendsQuery {
  q: unknown;
  dataType?: unknown;
  geo?: unknown;
  date?: unknown;
  save?: boolean;
}

/** Run a screening step; a rejection is logged as reason codes and minimal metadata only, then rethrown. */
function screened<T>(provider: string, engine: string, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof PolicyViolation) {
      logSignalEvent({
        event: "query_rejected",
        provider,
        engine,
        field: err.field,
        reasons: err.reasons,
        policy: QUERY_POLICY_VERSION,
      });
    }
    throw err;
  }
}

async function fetchSerp(
  run: RetrievalRun,
  engine: string,
  params: Record<string, unknown>,
  suppliedValues: string[],
): Promise<{ data: Record<string, unknown>; retrievedAt: string }> {
  run.assertProviderAllowed();   // strict mode: no network unless this run's attempt was acknowledged
  const retrievedAt = new Date().toISOString();
  const fail = (parts: { status?: number; code?: string; providerMessage?: unknown }): never => {
    const safe = safeProviderError("SerpAPI", parts, suppliedValues);
    logSignalEvent({ event: "retrieval_failed", provider: "serpapi", engine, error: safe.message });
    throw safe;
  };
  let data: Record<string, unknown>;
  try {
    const res = await axios.get("https://serpapi.com/search.json", { params, timeout: 30_000 });
    data = res.data as Record<string, unknown>;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as { error?: unknown } | undefined;
      return fail({ status: err.response?.status, code: err.code, providerMessage: body?.error });
    }
    return fail({});
  }
  if (data && typeof data.error === "string") return fail({ providerMessage: data.error });
  return { data, retrievedAt };
}

function withheld(
  engine: string,
  rec: { retrieval_id: string; saved: unknown; save_error: string | null },
  ledger?: Record<string, unknown>,
) {
  return {
    engine,
    withheld: true,
    withheld_reason: "sanitization could not be verified; no provider data is returned",
    retrieval_id: rec.retrieval_id,
    saved: rec.saved,
    save_error: rec.save_error,
    ...ledger,
  };
}

const QUERY_PARAM: Record<SerpEngine, string> = {
  google: "q",
  google_events: "q",
  google_maps: "q",
  youtube: "search_query",
  google_news: "q",
};

const RESULT_KEY: Record<SerpEngine, string> = {
  google: "organic_results",
  google_events: "events_results",
  google_maps: "local_results",
  youtube: "video_results",
  google_news: "news_results",
};

// ─── Retrieval ledger helpers (all inert when the ledger is off) ──────────────────────────────────────────────────

/** The ledger object added to a response in strict mode only; off mode leaves the response exactly as it was. */
async function ledgerField(run: RetrievalRun): Promise<{ ledger?: RunSummary }> {
  return run.active ? { ledger: await run.summary() } : {};
}

/** Number of result items: the array length, or 1 for a non-empty object, else 0. Counts only; never content. */
function resultCountOf(value: unknown): number {
  if (Array.isArray(value)) return Math.min(value.length, 100000);
  return value !== null && typeof value === "object" ? 1 : 0;
}

/** Names of the parameters actually sent (never values), without the engine and the credential. */
function paramNamesOf(params: Record<string, unknown>): string[] {
  return Object.keys(params).filter(k => k !== "engine" && k !== "api_key" && params[k] !== undefined).sort();
}

async function recordRejection(run: RetrievalRun, err: unknown, engine: Engine | undefined): Promise<void> {
  if (err instanceof PolicyViolation) {
    await run.rejected({ engine, field: err.field as RejectedField, reasons: err.reasons as ReasonCode[] });
  }
}

export async function serpSearch(query: SerpQuery): Promise<Record<string, unknown>> {
  if (!config.serpapi.apiKey) {
    throw new Error("SERPAPI_API_KEY is not set. Add it to the BLUME .env.");
  }
  const run = beginRetrieval();

  let engine: SerpEngine | undefined;
  let q = "";
  let location: string | undefined;
  try {
    engine = screened("serpapi", "serp", () => screenEnum("engine", query.engine, SERP_ENGINES, "google"));
    ({ q, location } = screened("serpapi", engine, () => ({
      q: screenText("q", query.q, { max: MAX_QUERY_LENGTH, mode: "query", required: true }) as string,
      location: screenText("location", query.location, { max: MAX_LOCATION_LENGTH, mode: "locality", required: false }),
    })));
  } catch (err) {
    await recordRejection(run, err, engine);
    throw err;
  }
  const eng = engine as SerpEngine;

  const params: Record<string, unknown> = {
    engine: eng,
    [QUERY_PARAM[eng]]: q,
    api_key: config.serpapi.apiKey,
  };
  if (location) params.location = location;
  const rawNum = Number(query.num ?? 10);
  const num = Math.min(Math.max(Number.isFinite(rawNum) ? Math.trunc(rawNum) : 10, 1), MAX_RESULTS);
  if (eng === "google") params.num = num;
  const saveRequested = query.save === true;

  // Strict mode: the attempt must be durably acknowledged BEFORE anything is sent to the provider. Throws LedgerUnavailable.
  await run.attempt({
    engine: eng, queryLength: q.length, hasLocation: Boolean(location), paramNames: paramNamesOf(params),
    saveRequested, numRequested: eng === "google" ? num : undefined,
  });

  let fetched: { data: Record<string, unknown>; retrievedAt: string };
  try {
    fetched = await fetchSerp(run, eng, params, [q, location ?? ""]);
  } catch (err) {
    await run.providerFailed({ engine: eng, errorCode: err instanceof ProviderError ? err.ledgerCode : "provider_error" });
    throw err;
  }
  const { data, retrievedAt } = fetched;
  await run.providerSucceeded({ engine: eng, resultCount: resultCountOf(data[RESULT_KEY[eng]]) });

  const rec = await recordRetrieval({
    provider: "serpapi", engine: eng, params, retrievedAt, response: data, save: saveRequested, retrievalId: run.retrievalId,
  });

  if (rec.sanitization_failed) {
    await run.sanitizationFailed({ engine: eng, stage: rec.sanitization_stage ?? "response" });
    await run.outputWithheld({ engine: eng });
    return withheld(eng, rec, await ledgerField(run));
  }
  if (rec.saved) await run.archived({ engine: eng, artifactUuid: rec.saved.uuid, artifactHash: rec.saved.hash });
  else if (saveRequested && rec.archive_error_code) await run.archiveFailed({ engine: eng, errorCode: rec.archive_error_code });

  let clean: Record<string, unknown>;
  try {
    clean = sanitizeStructure(data, "output").value as Record<string, unknown>;
  } catch {
    logSignalEvent({ event: "sanitization_failed", retrieval_id: rec.retrieval_id, stage: "output" });
    await run.sanitizationFailed({ engine: eng, stage: "output" });
    await run.outputWithheld({ engine: eng });
    return withheld(eng, rec, await ledgerField(run));
  }

  const results = (clean[RESULT_KEY[eng]] as unknown[] | undefined) ?? [];
  return {
    engine: eng,
    query: q,
    location,
    results: results.slice(0, num),
    related_searches: clean.related_searches ?? [],
    related_questions: clean.related_questions ?? [],
    search_id: (clean.search_metadata as { id?: string } | undefined)?.id,
    retrieval_id: rec.retrieval_id,
    saved: rec.saved,
    save_error: rec.save_error,
    ...(await ledgerField(run)),
  };
}

// ─── Google Trends ────────────────────────────────────────────────────────────

const TRENDS_RESULT_KEY: Record<TrendsDataType, string> = {
  TIMESERIES: "interest_over_time",
  GEO_MAP: "compared_breakdown_by_region",
  RELATED_QUERIES: "related_queries",
  RELATED_TOPICS: "related_topics",
};

export async function trendsSearch(query: TrendsQuery): Promise<Record<string, unknown>> {
  if (!config.serpapi.apiKey) {
    throw new Error("SERPAPI_API_KEY is not set. Add it to the BLUME .env.");
  }
  const run = beginRetrieval();

  let q = "";
  let dataType: TrendsDataType = "TIMESERIES";
  let geo: string | undefined;
  let date: string | undefined;
  try {
    ({ q, dataType, geo, date } = screened("serpapi", "google_trends", () => ({
      q: screenText("q", query.q, { max: MAX_QUERY_LENGTH, mode: "query", required: true }) as string,
      dataType: screenEnum("data_type", query.dataType, TRENDS_DATA_TYPES, "TIMESERIES"),
      geo: screenGeo(query.geo),
      date: screenTrendsDate(query.date),
    })));
  } catch (err) {
    await recordRejection(run, err, "google_trends");
    throw err;
  }

  const params: Record<string, unknown> = {
    engine: "google_trends",
    q,
    data_type: dataType,
    api_key: config.serpapi.apiKey,
  };
  if (geo) params.geo = geo;
  if (date) params.date = date;
  const saveRequested = query.save === true;

  await run.attempt({
    engine: "google_trends", queryLength: q.length, hasLocation: false, paramNames: paramNamesOf(params),
    saveRequested, dataType,
  });

  let fetched: { data: Record<string, unknown>; retrievedAt: string };
  try {
    fetched = await fetchSerp(run, "google_trends", params, [q]);
  } catch (err) {
    await run.providerFailed({ engine: "google_trends", errorCode: err instanceof ProviderError ? err.ledgerCode : "provider_error" });
    throw err;
  }
  const { data, retrievedAt } = fetched;
  await run.providerSucceeded({ engine: "google_trends", resultCount: resultCountOf(data[TRENDS_RESULT_KEY[dataType]]) });

  const rec = await recordRetrieval({
    provider: "serpapi", engine: "google_trends", params, retrievedAt, response: data, save: saveRequested, retrievalId: run.retrievalId,
  });

  if (rec.sanitization_failed) {
    await run.sanitizationFailed({ engine: "google_trends", stage: rec.sanitization_stage ?? "response" });
    await run.outputWithheld({ engine: "google_trends" });
    return withheld("google_trends", rec, await ledgerField(run));
  }
  if (rec.saved) await run.archived({ engine: "google_trends", artifactUuid: rec.saved.uuid, artifactHash: rec.saved.hash });
  else if (saveRequested && rec.archive_error_code) await run.archiveFailed({ engine: "google_trends", errorCode: rec.archive_error_code });

  let clean: Record<string, unknown>;
  try {
    clean = sanitizeStructure(data, "output").value as Record<string, unknown>;
  } catch {
    logSignalEvent({ event: "sanitization_failed", retrieval_id: rec.retrieval_id, stage: "output" });
    await run.sanitizationFailed({ engine: "google_trends", stage: "output" });
    await run.outputWithheld({ engine: "google_trends" });
    return withheld("google_trends", rec, await ledgerField(run));
  }

  return {
    engine: "google_trends",
    query: q,
    data_type: dataType,
    geo,
    date,
    result: clean[TRENDS_RESULT_KEY[dataType]] ?? null,
    search_id: (clean.search_metadata as { id?: string } | undefined)?.id,
    retrieval_id: rec.retrieval_id,
    saved: rec.saved,
    save_error: rec.save_error,
    ...(await ledgerField(run)),
  };
}
