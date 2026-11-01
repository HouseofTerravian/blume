// Hermetic guard shared by every test setup. Import it FIRST (before src/config.ts is evaluated).
//   - NODE_ENV=test
//   - no production credentials: Supabase, provider and model keys are blanked or faked
//   - no network: axios's default adapter and global fetch throw, so a test that forgets its mock fails loudly instead of
//     calling a live provider or database. Tests that mock `axios.get` replace the method and are unaffected.
import axios from "axios";

process.env.NODE_ENV = "test";
for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) process.env[k] = "";

export const NETWORK_BLOCKED = "network access is blocked in tests";
const blocked = (): never => { throw new Error(NETWORK_BLOCKED); };
(axios.defaults as { adapter: unknown }).adapter = blocked;
globalThis.fetch = (async () => blocked()) as typeof fetch;
