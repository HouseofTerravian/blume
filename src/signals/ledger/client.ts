// The ledger's only database client. It calls the DEPLOYED function thq_append_retrieval_event(p jsonb) through the
// service-role Supabase client. It never issues a direct INSERT.
//
// SAFE ERROR HANDLING: a failed call is classified from the HTTP status and the SQLSTATE `code` ONLY. The error's
// `message`, `details` and `hint` are never read, logged, stored or forwarded, because a database can echo rejected values
// in them. Everything returned from here is a closed FailureClass.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppendOptions, AppendResult, FailureClass, LedgerClient, LedgerEvent } from "./types.js";

export const APPEND_FUNCTION = "thq_append_retrieval_event";

/** Map an HTTP status and a SQLSTATE/PostgREST code to a closed failure class. */
export function classifyFailure(code: string | null | undefined, status: number | null | undefined, aborted = false): FailureClass {
  if (aborted) return "timeout";
  const c = typeof code === "string" ? code : "";
  switch (c) {
    case "23000": return "conflict";
    case "23505": return "seq_conflict";
    case "23514": return "validation";
    case "42501": return "permission";
    case "42883":
    case "PGRST202": return "function_missing";
    case "PGRST301":
    case "PGRST302": return "auth";
    default: break;
  }
  const s = typeof status === "number" ? status : 0;
  if (s === 401 || s === 403) return "auth";
  if (s === 429) return "rate_limited";
  if (s >= 500) return "server";
  if (s === 0) return "network";
  return "unknown";
}

export class SupabaseLedgerClient implements LedgerClient {
  constructor(private readonly getClient: () => SupabaseClient | null) {}

  async append(event: Readonly<LedgerEvent>, opts: AppendOptions): Promise<AppendResult> {
    const sb = this.getClient();
    if (!sb) return { ok: false, cls: "auth" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const { data, error, status } = await sb.rpc(APPEND_FUNCTION, { p: event }).abortSignal(controller.signal);
      if (error) {
        // Only `code` and `status` are read. error.message / details / hint are deliberately ignored.
        return { ok: false, cls: classifyFailure((error as { code?: string }).code, status, controller.signal.aborted) };
      }
      if (data === "inserted" || data === "duplicate") return { ok: true, status: data };
      return { ok: false, cls: "protocol" };
    } catch {
      return { ok: false, cls: controller.signal.aborted ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  }
}
