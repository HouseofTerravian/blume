// Shared fakes and helpers for the ledger tests. No network, no real database, no provider.
import fs from "fs";
import path from "path";
import axios from "axios";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowHash } from "../../src/signals/ledger/canonical.js";
import { resolveLedgerConfig, __resetLedgerConfigForTests, type LedgerConfig } from "../../src/signals/ledger/config.js";
import { __setLedgerClientForTests, __setLedgerDepsForTests } from "../../src/signals/ledger/index.js";
import { telemetry } from "../../src/signals/ledger/telemetry.js";
import { RetrievalRun, type WriterDeps } from "../../src/signals/ledger/writer.js";
import type { AppendResult, FailureClass, LedgerClient, LedgerEvent } from "../../src/signals/ledger/types.js";
import { __setSupabaseForTests } from "../../src/integrations/supabase.js";
import { TEST_VAULT } from "./setup.js";

export const STRICT_ENV: Record<string, string> = {
  BLUME_LEDGER_MODE: "strict",
  BLUME_WRITER_ID: "blume-test",
  SUPABASE_URL: "https://example.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "TESTSUPABASEKEY_0123456789abcdef",
};

/** Put the process in strict mode against the given fake database (latched config is reset first). */
export function useStrict(db: LedgerClient, extraEnv: Record<string, string> = {}): void {
  Object.assign(process.env, STRICT_ENV, extraEnv);
  __resetLedgerConfigForTests();
  __setLedgerClientForTests(db);
  __setLedgerDepsForTests({ sleep: async () => {} });
  telemetry.reset();
}

export function useOff(db: LedgerClient | null = null): void {
  delete process.env.BLUME_LEDGER_MODE;
  delete process.env.BLUME_WRITER_ID;
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  __resetLedgerConfigForTests();
  __setLedgerClientForTests(db);
  __setLedgerDepsForTests({});
  telemetry.reset();
}

// ─── A fake ledger database that models the DEPLOYED function's semantics ─────────────────────────────────────────

export type Behavior =
  | { kind: "ok" }
  | { kind: "fail"; cls: FailureClass }
  | { kind: "commit_then_fail"; cls: FailureClass }   // the row is committed but the acknowledgement is lost
  | { kind: "hang" }                                  // never answers
  | { kind: "throw" };

export class FakeLedgerDb implements LedgerClient {
  rows = new Map<string, LedgerEvent>();              // by event_id
  private seqOwner = new Map<string, string>();       // "<retrieval_id>:<seq>" -> event_id
  sent: string[] = [];                                // JSON of every payload sent (every try)
  script: Behavior[] = [];                            // consumed one per call
  down = false;                                       // every call fails with a network error, nothing is committed
  failTypes = new Map<string, FailureClass>();        // event_type -> class: that type always fails (nothing committed)
  inFlight = 0;
  maxInFlight = 0;
  delayMs = 0;

  private apply(event: LedgerEvent): AppendResult {
    const { row_hash, ...rest } = event;
    if (row_hash !== rowHash(rest)) return { ok: false, cls: "validation" };
    const existing = this.rows.get(event.event_id);
    if (existing) return existing.row_hash === row_hash ? { ok: true, status: "duplicate" } : { ok: false, cls: "conflict" };
    const key = `${event.retrieval_id}:${event.seq}`;
    if (this.seqOwner.has(key)) return { ok: false, cls: "seq_conflict" };
    this.rows.set(event.event_id, event);
    this.seqOwner.set(key, event.event_id);
    return { ok: true, status: "inserted" };
  }

  async append(event: Readonly<LedgerEvent>): Promise<AppendResult> {
    this.sent.push(JSON.stringify(event));
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      if (this.delayMs) await new Promise(r => setTimeout(r, this.delayMs));
      if (this.down) return { ok: false, cls: "network" };
      const forced = this.failTypes.get(event.event_type);
      if (forced) return { ok: false, cls: forced };
      const b = this.script.shift() ?? { kind: "ok" as const };
      switch (b.kind) {
        case "fail": return { ok: false, cls: b.cls };
        case "commit_then_fail": this.apply(event as LedgerEvent); return { ok: false, cls: b.cls };
        case "hang": return await new Promise<AppendResult>(() => {});
        case "throw": throw new Error("fake client exploded");
        default: return this.apply(event as LedgerEvent);
      }
    } finally {
      this.inFlight--;
    }
  }

  /** Event types of one retrieval in seq order. */
  typesOf(retrievalId: string): string[] {
    return [...this.rows.values()].filter(e => e.retrieval_id === retrievalId).sort((a, b) => a.seq - b.seq).map(e => e.event_type);
  }
  seqsOf(retrievalId: string): number[] {
    return [...this.rows.values()].filter(e => e.retrieval_id === retrievalId).map(e => e.seq).sort((a, b) => a - b);
  }
  retrievalIds(): string[] {
    return [...new Set([...this.rows.values()].map(e => e.retrieval_id))];
  }
  all(): LedgerEvent[] {
    return [...this.rows.values()];
  }
}

// ─── Writer unit-test helpers ─────────────────────────────────────────────────────────────────────────────────────

export const STRICT_CONFIG: LedgerConfig = resolveLedgerConfig(STRICT_ENV as NodeJS.ProcessEnv);

export function makeConfig(over: Partial<LedgerConfig> = {}): LedgerConfig {
  return { ...STRICT_CONFIG, ...over };
}

/** Deterministic id and clock sources so event content is reproducible in tests. */
let uuidCounter = 0;
export function makeDeps(db: LedgerClient, over: Partial<WriterDeps> = {}): WriterDeps {
  const uuid = (): string => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`;
  return {
    client: db,
    config: STRICT_CONFIG,
    telemetry,
    sleep: async () => {},
    now: () => new Date("2026-11-01T12:00:00.000Z"),
    uuid,
    ...over,
  };
}

export function newRun(db: LedgerClient, over: Partial<WriterDeps> = {}): RetrievalRun {
  return new RetrievalRun(makeDeps(db, over));
}

export const ATTEMPT = { engine: "google", queryLength: 7, hasLocation: false, paramNames: ["num", "q"], saveRequested: false, numRequested: 10 } as const;

// ─── Provider and artifact fakes ──────────────────────────────────────────────────────────────────────────────────

const realGet = axios.get;
export function mockProvider(handler: (cfg?: { params?: Record<string, unknown> }) => unknown): { calls: () => number } {
  let calls = 0;
  (axios as unknown as { get: unknown }).get = async (_url: string, cfg?: { params?: Record<string, unknown> }) => { calls++; return handler(cfg); };
  return { calls: () => calls };
}
export function restoreProvider(): void {
  (axios as unknown as { get: unknown }).get = realGet;
}

export const CAP = "https://serpapi.com/searches/FAKETOKENFAKETOKEN";
export const providerBody = (): Record<string, unknown> => ({
  search_metadata: { id: "abc123", created_at: "2026-10-31 04:19:15 UTC", json_endpoint: `${CAP}/xyz.json` },
  organic_results: [
    { title: "Matcha guide", link: "https://example.com/matcha", snippet: "All about matcha" },
    { title: "Matcha latte", link: "https://example.com/latte", snippet: "Latte recipes" },
  ],
  related_searches: [{ query: "matcha latte", link: "https://serpapi.com/search.json?engine=google&q=matcha+latte" }],
  interest_over_time: { timeline_data: [{ date: "Oct 2026", values: [{ value: "88" }] }] },
});

/** A fake Supabase client for the artifact mirror only (thq_artifacts insert/upsert); never touches a network. */
export function fakeSupabase(opts: { failMirror?: boolean } = {}): { client: SupabaseClient; inserted: string[] } {
  const inserted: string[] = [];
  const chain = (a: { uuid: string }) => ({
    select: () => ({
      single: async () => (opts.failMirror ? { data: null, error: { message: "mirror down" } } : (inserted.push(a.uuid), { data: a, error: null })),
    }),
  });
  const client = { from: () => ({ insert: chain, upsert: chain }) } as unknown as SupabaseClient;
  return { client, inserted };
}
export function useFakeSupabase(opts: { failMirror?: boolean } = {}): { inserted: string[] } {
  const f = fakeSupabase(opts);
  __setSupabaseForTests(f.client);
  return { inserted: f.inserted };
}
export function clearFakeSupabase(): void {
  __setSupabaseForTests(null);
}

export function storedArtifacts(): string[] {
  const dir = path.join(TEST_VAULT, "_artifacts", "house");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")) : [];
}
export function resetArtifacts(): void {
  fs.rmSync(path.join(TEST_VAULT, "_artifacts"), { recursive: true, force: true });
}
export function legacyLogExists(): boolean {
  return fs.existsSync(path.join(TEST_VAULT, "_signals", "retrieval-log.jsonl"));
}
export function resetLegacyLog(): void {
  fs.rmSync(path.join(TEST_VAULT, "_signals"), { recursive: true, force: true });
}
