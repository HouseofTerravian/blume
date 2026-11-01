"""Mutation testing for the retrieval-ledger writer.

For each mutant: copy src/ and test/ into .mutation-work/<id>/ (inside the repo so node_modules resolves), apply ONE source
change there, run the mocked test suites, and require the suite to FAIL ("killed"). A passing suite means the mutant
"survived" and a test is missing. The real src/ is never modified. Run: python test/ledger/mutation/mutations.py
"""
import os, re, shutil, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
WORK = os.path.join(ROOT, ".mutation-work")
L = "src/signals/ledger/"

# (id, file, old, new)  -- old must occur exactly once
MUTANTS = [
    # control: an identity change must PASS, proving the copied tree is a faithful, runnable suite (a harness that kills everything proves nothing)
    ("M00-control-identity", L + "canonical.ts", "export function rowHash", "export function rowHash"),
    ("M01-attempt-ack-not-required", L + "writer.ts",
     '      this.attemptState = "refused";\n      if (sent.outcome === "hard") {',
     '      this.attemptState = "acked";\n      return;\n      if (sent.outcome === "hard") {'),
    ("M02-no-retry", L + "writer.ts",
     "for (let i = 0; i <= policy.retries; i++) {", "for (let i = 0; i <= 0; i++) {"),
    ("M03-event-regenerated-on-retry", L + "writer.ts",
     "client.append(event, { timeoutMs: policy.timeoutMs })",
     "client.append(i > 0 ? { ...event, event_id: this.deps.uuid() } : event, { timeoutMs: policy.timeoutMs })"),
    ("M04-occurred-at-changed-on-retry", L + "writer.ts",
     "client.append(event, { timeoutMs: policy.timeoutMs })",
     "client.append(i > 0 ? { ...event, occurred_at: new Date(Date.now() + 1000).toISOString() } : event, { timeoutMs: policy.timeoutMs })"),
    ("M05-hard-failure-retried", L + "writer.ts",
     "if (HARD_FAILURES.has(result.cls)) {", "if (false && HARD_FAILURES.has(result.cls)) {"),
    ("M06-client-reads-error-message", L + "client.ts",
     "return { ok: false, cls: classifyFailure((error as { code?: string }).code, status, controller.signal.aborted) };",
     "return { ok: false, cls: classifyFailure((error as { code?: string }).code, status, controller.signal.aborted), detail: (error as { message?: string }).message } as never;"),
    ("M07-degraded-never-set", L + "writer.ts",
     "    this.degraded.add(code);", "    void code;"),
    ("M08-seq-not-incremented", L + "writer.ts",
     "nextSeq: () => ++this.seq,", "nextSeq: () => 1,"),
    ("M09-builder-validation-removed", L + "events.ts",
     "  check(type, body, now);\n", ""),
    ("M10-invalid-mode-falls-back-to-off", L + "config.ts",
     'if (rawMode !== "strict") return refuse("mode_invalid");',
     'if (rawMode !== "strict") return { mode: "off", valid: true, reason: null, writerId: null, appVersion, ...policies };'),
    ("M11-latch-removed", L + "config.ts",
     "  if (latched === null) latched = resolveLedgerConfig();\n  return latched;",
     "  return resolveLedgerConfig();"),
    ("M12-canonical-field-order-changed", L + "canonical.ts",
     '"event_id", "retrieval_id", "seq", "phase",', '"retrieval_id", "event_id", "seq", "phase",'),
    ("M13-serp-provider-called-without-awaiting-attempt", "src/signals/sources/serp.ts",
     "  await run.attempt({\n    engine: eng,", "  void run.attempt({\n    engine: eng,"),
    ("M14-legacy-jsonl-written-in-strict", "src/signals/envelope.ts",
     'if (getLedgerConfig().mode !== "off") return;', "if (false) return;"),
    ("M15-rejection-not-recorded", "src/signals/sources/serp.ts",
     "  if (err instanceof PolicyViolation) {\n    await run.rejected(", "  if (false) {\n    await run.rejected("),
    ("M16-deadline-removed", L + "writer.ts",
     "withDeadline(client.append(event, { timeoutMs: policy.timeoutMs }), policy.timeoutMs + 250)",
     "client.append(event, { timeoutMs: policy.timeoutMs })"),
    ("M17-outcome-without-attempt-allowed", L + "writer.ts",
     'if (this.attemptState !== "acked") { this.markDegraded(`${type}:not_attempted`); return; }', ""),
    ("M18-writes-not-serialised", L + "writer.ts",
     "const result = this.chain.then(fn);", "const result = fn();"),
    ("M19-conflict-classified-retryable", L + "client.ts",
     'case "23000": return "conflict";', 'case "23000": return "server";'),
    ("M20-validation-classified-retryable", L + "client.ts",
     'case "23514": return "validation";', 'case "23514": return "network";'),
    ("M21-duplicate-treated-as-failure", L + "client.ts",
     'if (data === "inserted" || data === "duplicate") return { ok: true, status: data };',
     'if (data === "inserted") return { ok: true, status: data };'),
    ("M22-config-invalid-ignored", L + "writer.ts",
     "      if (!config.valid) {\n        this.attemptState = \"refused\";",
     "      if (false) {\n        this.attemptState = \"refused\";"),
    ("M23-backoff-skipped", L + "writer.ts",
     "await sleep(policy.backoffMs[Math.min(i, policy.backoffMs.length - 1)] ?? 0);", "void sleep;"),
    ("M24-retries-unbounded", L + "writer.ts",
     "for (let i = 0; i <= policy.retries; i++) {", "for (let i = 0; i <= policy.retries + 3; i++) {"),
    ("M25-event-not-frozen", L + "events.ts",
     "return deepFreeze({ ...body, row_hash: rowHash(body as Omit<LedgerEvent, \"row_hash\">) } as unknown as LedgerEvent);",
     "return ({ ...body, row_hash: rowHash(body as Omit<LedgerEvent, \"row_hash\">) } as unknown as LedgerEvent);"),
    ("M27-fetch-gate-removed", "src/signals/sources/serp.ts",
     "  run.assertProviderAllowed();   // strict mode: no network unless this run's attempt was acknowledged\n", ""),
    ("M28-gate-ignores-attempt-state", L + "writer.ts",
     '    if (this.attemptState !== "acked") throw new LedgerUnavailable("ledger_unavailable");', ""),
    ("M29-supabase-test-guard-removed", "src/integrations/supabase.ts",
     '  if (process.env.NODE_ENV === "test") return null;\n', ""),
    ("M30-uppercase-mode-means-off", L + "config.ts",
     'if (rawMode === "" || rawMode === "off") {', 'if (rawMode === "" || rawMode.toLowerCase() === "off" || rawMode === "OFF") {'),
    ("M31-startup-notice-hides-mode", L + "index.ts",
     'if (c.mode === "off") return `retrieval ledger: mode=off (no ledger events are written)${test}`;', 'if (c.mode === "off") return "";'),
    ("M26-ledger-summary-never-returned", "src/signals/sources/serp.ts",
     "return run.active ? { ledger: await run.summary() } : {};", "return {};"),
]


def sh(cmd, cwd, timeout):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=timeout)


def main():
    only = sys.argv[1:]
    if os.path.isdir(WORK):
        shutil.rmtree(WORK)
    os.makedirs(WORK)
    survivors, killed, broken = [], [], []
    for mid, rel, old, new in MUTANTS:
        if only and not any(mid.startswith(o) for o in only):
            continue
        d = os.path.join(WORK, mid)
        for part in ("src", "test"):
            shutil.copytree(os.path.join(ROOT, part), os.path.join(d, part), ignore=shutil.ignore_patterns("contract", "mutation"))
        for f in ("package.json", "tsconfig.json"):
            shutil.copy(os.path.join(ROOT, f), d)
        path = os.path.join(d, rel)
        text = open(path, encoding="utf-8").read()
        if text.count(old) != 1:
            print(f"BROKEN   {mid}: pattern occurs {text.count(old)} times")
            broken.append(mid)
            shutil.rmtree(d, ignore_errors=True)
            continue
        open(path, "w", encoding="utf-8", newline="").write(text.replace(old, new, 1))
        t0 = time.time()
        try:
            r = sh("npx tsx --test --test-timeout=20000 test/signals/*.test.ts test/ledger/*.test.ts", d, 600)
            code = r.returncode
        except subprocess.TimeoutExpired:
            code = 124  # a hang counts as detected: the suite did not pass
        if mid.startswith("M00"):
            print(f"{'control ok' if code == 0 else 'CONTROL FAILED'} {mid} ({time.time() - t0:.0f}s)", flush=True)
            if code != 0:
                print(r.stdout[-1500:])
                sys.exit(2)
            shutil.rmtree(d, ignore_errors=True)
            continue
        status = "SURVIVED" if code == 0 else "killed  "
        how = ""
        if code != 0:
            out = r.stdout if code != 124 else ""
            failed = [l.strip() for l in out.splitlines() if l.strip().startswith("not ok")]
            kinds = re.findall(r"failureType: '(\w+)'", out)
            assertion = sum(1 for k in kinds if k == "testCodeFailure")
            timeouts = sum(1 for k in kinds if k == "testTimeoutFailure")
            how = f" [assertion failures: {assertion}, timeout failures: {timeouts}]" if code != 124 else " [WHOLE-RUN TIMEOUT]"
            if os.environ.get("MUT_VERBOSE"):
                how += "".join(chr(10) + "      " + l[:140] for l in failed[:8])
        print(f"{status} {mid} ({time.time() - t0:.0f}s){how}", flush=True)
        (survivors if code == 0 else killed).append(mid)
        shutil.rmtree(d, ignore_errors=True)
    shutil.rmtree(WORK, ignore_errors=True)
    print(f"\nmutants: {len(killed) + len(survivors)}  killed: {len(killed)}  survived: {len(survivors)}  broken patterns: {len(broken)}")
    for s in survivors:
        print("  survivor:", s)
    sys.exit(1 if survivors or broken else 0)


main()
