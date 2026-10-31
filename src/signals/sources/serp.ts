// SerpAPI source — https://serpapi.com/search-api
// Engines: google (web), google_events, google_maps, youtube, google_news.

import axios from "axios";
import { config } from "../../config.js";

export type SerpEngine = "google" | "google_events" | "google_maps" | "youtube" | "google_news";

export interface SerpQuery {
  engine?: SerpEngine;
  q: string;
  location?: string;
  num?: number;
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
  const engine = query.engine ?? "google";
  const params: Record<string, unknown> = {
    engine,
    [QUERY_PARAM[engine]]: query.q,
    api_key: config.serpapi.apiKey,
  };
  if (query.location) params.location = query.location;
  if (query.num && engine === "google") params.num = query.num;

  const res = await axios.get("https://serpapi.com/search.json", { params, timeout: 30_000 });
  const data = res.data as Record<string, unknown>;
  if (typeof data.error === "string") throw new Error(`SerpAPI: ${data.error}`);

  const results = (data[RESULT_KEY[engine]] as unknown[] | undefined) ?? [];
  return {
    engine,
    query: query.q,
    location: query.location,
    results: query.num ? results.slice(0, query.num) : results,
    related_searches: data.related_searches ?? [],
    related_questions: data.related_questions ?? [],
    search_id: (data.search_metadata as { id?: string } | undefined)?.id,
  };
}

// ─── Google Trends ────────────────────────────────────────────────────────────

export type TrendsDataType = "TIMESERIES" | "GEO_MAP" | "RELATED_QUERIES" | "RELATED_TOPICS";

export interface TrendsQuery {
  q: string;
  dataType?: TrendsDataType;
  geo?: string;
  date?: string;
}

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
  const dataType = query.dataType ?? "TIMESERIES";
  const params: Record<string, unknown> = {
    engine: "google_trends",
    q: query.q,
    data_type: dataType,
    api_key: config.serpapi.apiKey,
  };
  if (query.geo) params.geo = query.geo;
  if (query.date) params.date = query.date;

  const res = await axios.get("https://serpapi.com/search.json", { params, timeout: 30_000 });
  const data = res.data as Record<string, unknown>;
  if (typeof data.error === "string") throw new Error(`SerpAPI: ${data.error}`);

  return {
    engine: "google_trends",
    query: query.q,
    data_type: dataType,
    geo: query.geo,
    date: query.date,
    result: data[TRENDS_RESULT_KEY[dataType]] ?? null,
    search_id: (data.search_metadata as { id?: string } | undefined)?.id,
  };
}
