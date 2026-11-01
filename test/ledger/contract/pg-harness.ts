// Isolated local-PostgreSQL harness for the ledger CONTRACT suite.
//
// Starts a THROWAWAY cluster on loopback in a temp directory, simulates the Supabase roles, applies the DEPLOYED migration
// from the revenue-core-infra repository, and exposes a LedgerClient that calls the real thq_append_retrieval_event function
// as service_role. It never connects to Supabase or anything on a network, and removes the cluster afterwards.
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { classifyFailure } from "../../../src/signals/ledger/client.js";
import type { AppendOptions, AppendResult, LedgerClient, LedgerEvent } from "../../../src/signals/ledger/types.js";

const PGBIN = process.env.LEDGER_CONTRACT_PGBIN ?? "C:/Users/chude/scoop/apps/postgresql/current/bin";
const PORT = process.env.LEDGER_CONTRACT_PORT ?? "54450";
const INFRA = process.env.REVENUE_CORE_INFRA ?? "C:/dev/active/revenue-core-infra";
const MIGRATION = path.join(INFRA, "supabase/migrations/20261031221514_thq_retrieval_events_ledger.sql");
const BOOTSTRAP = path.join(INFRA, "scripts/local-test/bootstrap.sql");
const DB = "ledger_contract";

export function contractPrerequisites(): string | null {
  for (const b of ["initdb.exe", "pg_ctl.exe", "psql.exe"]) if (!fs.existsSync(path.join(PGBIN, b))) return `PostgreSQL binary missing: ${b} in ${PGBIN}`;
  if (!fs.existsSync(MIGRATION)) return "the deployed migration file was not found (set REVENUE_CORE_INFRA)";
  if (!fs.existsSync(BOOTSTRAP)) return "the local-test bootstrap.sql was not found (set REVENUE_CORE_INFRA)";
  return null;
}

function run(cmd: string, args: string[], input?: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(path.join(PGBIN, cmd), args, { encoding: "utf-8", input, env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" } });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Start the server detached from our pipes: a server that inherits them would keep spawnSync waiting forever. */
function startServer(dataDir: string): number {
  const r = spawnSync(path.join(PGBIN, "pg_ctl"), ["-D", dataDir, "-l", path.join(dataDir, "server.log"), "-w", "-o", `-p ${PORT} -c listen_addresses=127.0.0.1 -c fsync=off`, "start"],
    { stdio: "ignore", env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" } });
  return r.status ?? -1;
}

export class PgHarness {
  private data = "";
  started = false;

  start(): void {
    this.data = fs.mkdtempSync(path.join(process.env.BLUME_TEST_TMP ?? os.tmpdir(), "ledger-contract-"));
    const init = run("initdb", ["-D", this.data, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-locale"]);
    if (init.status !== 0) throw new Error("initdb failed");
    if (startServer(this.data) !== 0) {
      const log = path.join(this.data, "server.log");
      const reason = fs.existsSync(log) && /address already in use|could not bind/i.test(fs.readFileSync(log, "utf-8")) ? "port in use (set LEDGER_CONTRACT_PORT)" : "see server.log";
      fs.rmSync(this.data, { recursive: true, force: true });
      throw new Error(`pg_ctl start failed: ${reason}`);
    }
    this.started = true;
    try {
      this.admin("postgres", `create database ${DB}`);
      this.file(BOOTSTRAP);
      this.file(MIGRATION);
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  stop(): void {
    if (this.started) run("pg_ctl", ["-D", this.data, "-m", "immediate", "stop"]);
    this.started = false;
    if (this.data) fs.rmSync(this.data, { recursive: true, force: true });
  }

  private admin(db: string, sql: string): void {
    const r = run("psql", ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", db, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql]);
    if (r.status !== 0) throw new Error("admin psql failed");
  }

  private file(f: string): void {
    const r = run("psql", ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", DB, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", f]);
    if (r.status !== 0) throw new Error(`applying ${path.basename(f)} failed`);
  }

  /** Run SQL as the superuser (inspection and setup); returns trimmed stdout. Throws on SQL error. */
  sql(query: string): string {
    const r = run("psql", ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", DB, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-c", query]);
    if (r.status !== 0) throw new Error(`sql failed: ${r.stderr.split("\n")[0]}`);
    return r.stdout.trim();
  }

  /** Run SQL as service_role; returns stdout and the SQLSTATE of an error (VERBOSITY=sqlstate prints only the code). */
  asServiceRole(query: string): { ok: boolean; stdout: string; sqlstate: string | null } {
    const r = run("psql", ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", "-d", DB, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-c", `set role service_role; ${query}`]);
    const m = /ERROR:\s+([0-9A-Z]{5})/.exec(r.stderr);
    return { ok: r.status === 0, stdout: r.stdout.trim(), sqlstate: m ? m[1] : null };
  }

  /** Make the raw artifact mirror visible to the reconciliation view (the real mirror writes thq_artifacts). */
  mirrorArtifact(uuid: string, hash: string, tsExpr = "now() + interval '1 minute'"): void {
    this.sql(`insert into public.thq_artifacts (uuid, hash, "timestamp", metadata) values ('${uuid}', '${hash}', ${tsExpr}, '{"kind":"tpig.raw_signal"}')`);
  }

  reconciliation(): { issue: string; retrieval_id: string | null; artifact_uuid: string | null }[] {
    const out = this.sql(`set thq.reconcile_grace = '-1 second'; select coalesce(json_agg(json_build_object('issue', issue, 'retrieval_id', retrieval_id, 'artifact_uuid', artifact_uuid)), '[]'::json) from public.thq_retrieval_reconciliation`);
    return JSON.parse(out.split("\n").filter(l => l.startsWith("[")).pop() ?? "[]");
  }
}

/** A LedgerClient that calls the REAL deployed function as service_role. Errors are classified from the SQLSTATE only. */
export class PgLedgerClient implements LedgerClient {
  constructor(private readonly h: PgHarness) {}
  async append(event: Readonly<LedgerEvent>, _opts: AppendOptions): Promise<AppendResult> {
    const r = this.h.asServiceRole(`select public.thq_append_retrieval_event($j$${JSON.stringify(event)}$j$::jsonb)`);
    if (r.ok && (r.stdout === "inserted" || r.stdout === "duplicate")) return { ok: true, status: r.stdout };
    if (r.ok) return { ok: false, cls: "protocol" };
    return { ok: false, cls: classifyFailure(r.sqlstate, r.sqlstate ? 400 : 0) };
  }
}
