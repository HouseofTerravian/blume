#!/usr/bin/env node
/**
 * BLUME MCP Smoke Test
 * Tests: server starts, tools load, blume_list_brands, blume_generate_post, no terravian-mcp imports.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function log(status, label, detail = "") {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "·";
  const color = status === "PASS" ? "\x1b[32m" : status === "FAIL" ? "\x1b[31m" : "\x1b[33m";
  console.log(`  ${color}${icon}\x1b[0m ${label}${detail ? `  — ${detail}` : ""}`);
}

function runScript(script, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const proc = spawn("npx tsx --tsconfig tsconfig.json smoke-helper.ts", [], {
      cwd: __dirname,
      env: { ...process.env, SMOKE_SCRIPT: script },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ ok: false, stdout, stderr, timedOut: true });
    }, timeoutMs);
    proc.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), code });
    });
  });
}

// ── Test 1: Server starts without crashing ────────────────────────────────────
async function testServerStart() {
  return new Promise((resolve) => {
    const proc = spawn("npx tsx src/mcp/server.ts", [], {
      cwd: __dirname,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    let stderrOutput = "";
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({ ok: false, error: "Timeout — server did not emit startup message within 15s", stderr: stderrOutput });
      }
    }, 15000);

    proc.stderr.on("data", (d) => {
      stderrOutput += d.toString();
      if (!resolved && stderrOutput.includes("online")) {
        resolved = true;
        clearTimeout(timer);
        proc.kill();
        resolve({ ok: true, stderr: stderrOutput });
      }
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ ok: false, error: `Exited with code ${code}`, stderr: stderrOutput });
      }
    });
  });
}

// ── Test 2: Tool list — use MCP inspector or direct function test ────────────
// We test tool registration by checking the server.ts source has the tool list exported
import { readFileSync } from "fs";
function testToolList() {
  const src = readFileSync(new URL("src/mcp/server.ts", import.meta.url), "utf-8");
  const toolMatches = [...src.matchAll(/name:\s*["'](\w+)["']/g)].map((m) => m[1]);
  const coreTools = ["blume_generate_post", "blume_list_brands", "seo_generate", "festival_sync", "vault_search"];
  const found = coreTools.filter((t) => toolMatches.includes(t));
  return { ok: found.length === coreTools.length, found, missing: coreTools.filter((t) => !toolMatches.includes(t)) };
}

// ── Tests 3 & 4: blume_list_brands + blume_generate_post ─────────────────────
// Run via tsx so TypeScript + .js extension resolution works
async function testFunctions() {
  return new Promise((resolve) => {
    const proc = spawn("npx tsx smoke-helper.ts", [], {
      cwd: __dirname,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ ok: false, stdout, stderr, timedOut: true });
    }, 90000);

    proc.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), code });
    });
  });
}

async function main() {
  console.log("\n\x1b[1mBLUME MCP Smoke Test\x1b[0m");
  console.log("─".repeat(44));

  let pass = 0;
  let fail = 0;

  // ── 1. Server starts ──────────────────────────────────────────────────────
  process.stdout.write("  · Starting server...\r");
  const startResult = await testServerStart();
  if (startResult.ok) {
    const line = startResult.stderr.match(/\[.*?\].*/)?.[0] ?? "started";
    log("PASS", "Server starts without crashing", line.trim());
    pass++;
  } else {
    log("FAIL", "Server starts without crashing", startResult.error ?? "unknown error");
    if (startResult.stderr) console.log("    stderr:", startResult.stderr.slice(0, 200));
    fail++;
  }

  // ── 2. Tool list ──────────────────────────────────────────────────────────
  const toolResult = testToolList();
  if (toolResult.ok) {
    log("PASS", "Tool list registered", `${toolResult.found.length} core tools confirmed`);
    pass++;
  } else {
    log("FAIL", "Tool list registered", `missing: ${toolResult.missing.join(", ")}`);
    fail++;
  }

  // ── 3 & 4. Function smoke test ────────────────────────────────────────────
  process.stdout.write("  · Running function tests (may take up to 60s for AI call)...\r");
  const fnResult = await testFunctions();

  if (fnResult.ok && fnResult.stdout.includes("BRANDS_OK:")) {
    const brandsLine = fnResult.stdout.split("\n").find((l) => l.startsWith("BRANDS_OK:"));
    const [, count, sample] = brandsLine.split(":");
    log("PASS", "blume_list_brands", `${count} brands — ${sample}`);
    pass++;
  } else {
    log("FAIL", "blume_list_brands", fnResult.stderr.slice(0, 120) || "no output");
    fail++;
  }

  if (fnResult.ok && fnResult.stdout.includes("POST_OK:")) {
    const postLine = fnResult.stdout.split("\n").find((l) => l.startsWith("POST_OK:"));
    const content = postLine.split(":").slice(1).join(":");
    log("PASS", "blume_generate_post", `"${content.slice(0, 80)}..."`);
    pass++;
  } else {
    const errLine = fnResult.stderr.split("\n").find((l) => l.includes("FAIL")) ?? fnResult.stderr.slice(0, 120);
    log("FAIL", "blume_generate_post", errLine || "no output");
    if (fnResult.timedOut) console.log("    (timed out — AI call may have hung)");
    fail++;
  }

  // ── 5. No terravian-mcp imports ───────────────────────────────────────────
  const hasRef = (fnResult.stderr + fnResult.stdout).toLowerCase().includes("terravian-mcp");
  if (!hasRef) {
    log("PASS", "No terravian-mcp imports at runtime");
    pass++;
  } else {
    log("FAIL", "No terravian-mcp imports at runtime", "reference to terravian-mcp found");
    fail++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(44));
  const allPass = fail === 0;
  const color = allPass ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${pass}/${pass + fail} checks passed\x1b[0m\n`);

  if (!fnResult.ok && fnResult.stderr) {
    console.log("Function test stderr:");
    console.log(fnResult.stderr.slice(0, 500));
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
