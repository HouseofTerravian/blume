// Test isolation. Import this FIRST in every signals test: it must run before src/config.ts is evaluated.
// - temp vault root (never the real ./vaults)
// - Supabase forced off (no live writes)
// - fake provider key (never the real one)
import "../hermetic.js";
import fs from "fs";
import os from "os";
import path from "path";

process.env.NODE_ENV = "test";
export const TEST_VAULT = fs.mkdtempSync(path.join(process.env.BLUME_TEST_TMP ?? os.tmpdir(), "blume-test-"));
export const FAKE_KEY = "TESTSERPKEY_9f8e7d6c5b4a39281706f5e4d3c2b1a0";
process.env.VAULT_ROOT = TEST_VAULT;
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.SERPAPI_API_KEY = FAKE_KEY;

const logPath = () => path.join(TEST_VAULT, "_signals", "retrieval-log.jsonl");

export function readLog(): Record<string, unknown>[] {
  if (!fs.existsSync(logPath())) return [];
  return fs.readFileSync(logPath(), "utf-8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
}
export function rawLog(): string {
  return fs.existsSync(logPath()) ? fs.readFileSync(logPath(), "utf-8") : "";
}
export function resetLog(): void {
  fs.rmSync(path.join(TEST_VAULT, "_signals"), { recursive: true, force: true });
}
export function storedRawSignals(): string[] {
  const dir = path.join(TEST_VAULT, "_artifacts", "house");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")) : [];
}
export function cleanup(): void {
  fs.rmSync(TEST_VAULT, { recursive: true, force: true });
}
