/* BLUME-032 vault migration test (8→12 canonical). Run: tsx scripts/vault-migration-smoke.ts */
import fs from "fs";
import path from "path";
import { config } from "../src/config.js";
import { VAULT_NAMES, VAULT_DESCRIPTIONS, ACTIVE_VAULTS } from "../src/vault/types.js";
import { initBrandVaults, saveToVault, readVault, logPost, logProofOfUse, logCommerceEvent, getBrandVaultSummary } from "../src/vault/index.js";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const B = "vault-mig-brand";

// ── canonical taxonomy ──
ok(Object.keys(VAULT_NAMES).length === 12, "12 vaults");
ok(VAULT_NAMES[1] === "published-works" && VAULT_NAMES[2] === "proof-of-use" && VAULT_NAMES[3] === "commerce-evidence" && VAULT_NAMES[4] === "brand-assets", "core 1–4 canonical slugs (legacy-int preserved)");
ok(VAULT_NAMES[5] === "legal", "vault 5 → legal (was legal-disclaimers)");
ok(VAULT_NAMES[8] === "investor", "vault 8 → investor (was investment-funding)");
ok(VAULT_NAMES[9] === "rnd" && VAULT_NAMES[11] === "memory" && VAULT_NAMES[12] === "library", "added 9 R&D · 11 Memory · 12 Library");
ok(VAULT_NAMES[10] === "compliance", "10 compliance present (parked)");
ok(ACTIVE_VAULTS.length === 11 && !ACTIVE_VAULTS.includes(10) && ACTIVE_VAULTS.includes(11) && ACTIVE_VAULTS.includes(12), "ACTIVE_VAULTS = 11 (compliance excluded)");
ok(Object.keys(VAULT_DESCRIPTIONS).length === 12, "12 descriptions");

// ── init creates active dirs, skips parked compliance ──
initBrandVaults(B);
const dir = (v: number) => path.join(config.vault.root, B, `vault-${v}-${VAULT_NAMES[v as 1]}`);
ok(fs.existsSync(dir(1)) && fs.existsSync(dir(9)) && fs.existsSync(dir(11)) && fs.existsSync(dir(12)), "init created active dirs incl 9/11/12");
ok(!fs.existsSync(dir(10)), "compliance(10) NOT initialized (parked)");

// ── new vaults usable ──
saveToVault(B, 11, { vault: 11, brand: B, title: "decision", content: "memory entry", tags: [], metadata: {} });
saveToVault(B, 9, { vault: 9, brand: B, title: "experiment", content: "rnd entry", tags: [], metadata: {} });
ok(readVault(B, 11).length === 1, "save/read works for Memory(11)");
ok(readVault(B, 9).length === 1, "save/read works for R&D(9)");

// ── legacy log helpers preserve meaning ──
logPost(B, { platform: "twitter", content: "post" });
logProofOfUse(B, { description: "proof" });
logCommerceEvent(B, { type: "sale", description: "sale" });
ok(readVault(B, 1).length === 1 && readVault(B, 1)[0].content === "post", "logPost → vault 1 (published-works)");
ok(readVault(B, 2).length === 1, "logProofOfUse → vault 2 (proof-of-use)");
ok(readVault(B, 3).length === 1, "logCommerceEvent → vault 3 (commerce-evidence)");

// ── summary spans 12 canonical vaults ──
const sum = getBrandVaultSummary(B);
ok(Object.keys(sum).length === 12, "summary has 12 vault keys");
ok("vault-8-investor" in sum && "vault-12-library" in sum && "vault-5-legal" in sum, "summary uses canonical slugs (investor/library/legal)");

console.log(`\nVAULT MIGRATION: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
