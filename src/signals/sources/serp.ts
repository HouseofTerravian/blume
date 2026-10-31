// SerpAPI source — https://serpapi.com/search-api
// Engines: google (web), google_events, google_maps, youtube, google_news.
//
// Policy: every parameter is screened (tpig-query-policy-1) BEFORE any network request, provider errors are
// reduced to caller-safe text, and everything returned to the caller is built from the verified sanitized
// response (tpig-sanitize-2). See docs/doctrine/tpig-query-and-pii-policy.md.

import axios from "axios";
import { config } from "../../config.js";
import { MAX_RESULTS, logSignalEvent, recordRetrieval } from "../envelope.js";
import {
  PolicyViolation,
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
  engine: string,
  params: Record<string, unknown>,
  suppliedValues: string[],
): Promise<{ data: Record<string, unknown>; retrievedAt: string }> {
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

function withheld(engine: string, rec: { retrieval_id: string; saved: unknown; save_error: string | null }) {
  return {
    engine,
    withheld: true,
    withheld_reason: "sanitization could not be verified; no provider data is returned",
    retrieval_id: rec.retrieval_id,
    saved: rec.saved,
    save_error: rec.save_error,
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

export async function serpSearch(query: SerpQuery): Promise<Record<string, unknown>> {
  if (!config.serpapi.apiKey) {
    throw new Error("SERPAPI_API_KEY is not set. Add it to the BLUME .env.");
  }
  const engine = screened("serpapi", "serp", () => screenEnum("engine", query.engine, SERP_ENGINES, "google"));
  const { q, location } = screened("serpapi", engine, () => ({
    q: screenText("q", query.q, { max: MAX_QUERY_LENGTH, mode: "query", required: true }) as string,
    location: screenText("location", query.location, { max: MAX_LOCATION_LENGTH, mode: "locality", required: false }),
  }));

  const params: Record<string, unknown> = {
    engine,
    [QUERY_PARAM[engine]]: q,
    api_key: config.serpapi.apiKey,
  };
  if (location) params.location = location;
  const rawNum = Number(query.num ?? 10);
  const num = Math.min(Math.max(Number.isFinite(rawNum) ? Math.trunc(rawNum) : 10, 1), MAX_RESULTS);
  if (engine === "google") params.num = num;

  const { data, retrievedAt } = await fetchSerp(engine, params, [q, location ?? ""]);
  const rec = await recordRetrieval({
    provider: "serpapi", engine, params, retrievedAt, response: data, save: query.save === true,
  });

  let clean: Record<string, unknown>;
  try {
    if (rec.sanitization_failed) return withheld(engine, rec);
    clean = sanitizeStructure(data, "output").value as Record<string, unknown>;
  } catch {
    logSignalEvent({ event: "sanitization_failed", retrieval_id: rec.retrieval_id, stage: "output" });
    return withheld(engine, rec);
  }

  const results = (clean[RESULT_KEY[engine]] as unknown[] | undefined) ?? [];
  return {
    engine,
    query: q,
    location,
    results: results.slice(0, num),
    related_searches: clean.related_searches ?? [],
    related_questions: clean.related_questions ?? [],
    search_id: (clean.search_metadata as { id?: string } | undefined)?.id,
    retrieval_id: rec.retrieval_id,
    saved: rec.saved,
    save_error: rec.save_error,
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
  const { q, dataType, geo, date } = screened("serpapi", "google_trends", () => ({
    q: screenText("q", query.q, { max: MAX_QUERY_LENGTH, mode: "query", required: true }) as string,
    dataType: screenEnum("data_type", query.dataType, TRENDS_DATA_TYPES, "TIMESERIES"),
    geo: screenGeo(query.geo),
    date: screenTrendsDate(query.date),
  }));

  const params: Record<string, unknown> = {
    engine: "google_trends",
    q,
    data_type: dataType,
    api_key: config.serpapi.apiKey,
  };
  if (geo) params.geo = geo;
  if (date) params.date = date;

  const { data, retrievedAt } = await fetchSerp("google_trends", params, [q]);
  const rec = await recordRetrieval({
    provider: "serpapi", engine: "google_trends", params, retrievedAt, response: data, save: query.save === true,
  });

  let clean: Record<string, unknown>;
  try {
    if (rec.sanitization_failed) return withheld("google_trends", rec);
    clean = sanitizeStructure(data, "output").value as Record<string, unknown>;
  } catch {
    logSignalEvent({ event: "sanitization_failed", retrieval_id: rec.retrieval_id, stage: "output" });
    return withheld("google_trends", rec);
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
  };
}
