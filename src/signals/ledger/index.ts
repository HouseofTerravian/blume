// Entry point of the ledger writer for the rest of BLUME: `beginRetrieval()` returns the run for one retrieval.
// In off mode (the default) the run is inert, so wiring it in changes nothing.

import { randomUUID } from "crypto";
import { getSupabase } from "../../integrations/supabase.js";
import { SupabaseLedgerClient } from "./client.js";
import { getLedgerConfig } from "./config.js";
import { telemetry } from "./telemetry.js";
import { RetrievalRun, type WriterDeps } from "./writer.js";
import type { LedgerClient } from "./types.js";

export { RetrievalRun, LedgerUnavailable, type RunSummary } from "./writer.js";
export { telemetry } from "./telemetry.js";
export { getLedgerConfig } from "./config.js";

let client: LedgerClient | null = null;
let overrides: Partial<Pick<WriterDeps, "sleep" | "now" | "uuid">> = {};

function ledgerClient(): LedgerClient {
  if (client === null) client = new SupabaseLedgerClient(getSupabase);
  return client;
}

export function beginRetrieval(): RetrievalRun {
  return new RetrievalRun({
    client: ledgerClient(),
    config: getLedgerConfig(),
    telemetry,
    sleep: overrides.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))),
    now: overrides.now ?? (() => new Date()),
    uuid: overrides.uuid ?? (() => randomUUID()),
  });
}

/** Test seams only. Production code never calls these. */
export function __setLedgerClientForTests(c: LedgerClient | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("ledger test seams are only available when NODE_ENV=test");
  client = c;
}
export function __setLedgerDepsForTests(o: Partial<Pick<WriterDeps, "sleep" | "now" | "uuid">>): void {
  if (process.env.NODE_ENV !== "test") throw new Error("ledger test seams are only available when NODE_ENV=test");
  overrides = o;
}
