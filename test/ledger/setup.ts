// Isolation for the ledger tests. Import this FIRST in every ledger test: it must run before src/config.ts is evaluated.
//   - temp vault root (never the real ./vaults)
//   - no Supabase credentials and no network: ledger traffic goes to in-memory fakes
//   - a fake provider key (never the real one)
//   - the ledger mode starts unset (off); tests opt into strict explicitly
import "../hermetic.js";
import fs from "fs";
import os from "os";
import path from "path";

process.env.NODE_ENV = "test";
export const TEST_VAULT = fs.mkdtempSync(path.join(process.env.BLUME_TEST_TMP ?? os.tmpdir(), "blume-ledger-test-"));
export const FAKE_KEY = "TESTSERPKEY_9f8e7d6c5b4a39281706f5e4d3c2b1a0";
process.env.VAULT_ROOT = TEST_VAULT;
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.SERPAPI_API_KEY = FAKE_KEY;
delete process.env.BLUME_LEDGER_MODE;
delete process.env.BLUME_WRITER_ID;

export function cleanup(): void {
  fs.rmSync(TEST_VAULT, { recursive: true, force: true });
}
