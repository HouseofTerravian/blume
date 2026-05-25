# BLUME Baby Bridge — Runtime Verification Checklist

**Date:** 2026-05-25
**Bridge status:** Active — `blume_list_brands` only
**Migration gate:** Do not migrate tool #2 until all items in Section 10 are confirmed

---

## 1. What Changed

| Layer | Change |
|---|---|
| `terravian-mcp/src/adapters/blume.ts` | New file — imports `listBrands` from `@terravian/blume`, exports `blumeListBrandsAdapter()` |
| `terravian-mcp/src/server.ts` | `blume_list_brands` case now calls `await blumeListBrandsAdapter()` instead of local `getBrands()` |
| `terravian-mcp/node_modules/@terravian/blume` | Symlinked to `C:/dev/active/blume` via `npm link` |
| `blume/` | No source changes — `listBrands` was already exported |

---

## 2. What Did Not Change

- All other 41 terravian-mcp tools are untouched
- `blume_generate_post`, `blume_aida_sequence`, `blume_post`, `blume_tweet` — still call local `agents/blume/`
- All vault tools — still call local `agents/blume/vault.ts`
- All brand management tools except `blume_list_brands` — still call local `getBrands`, `registerBrand`, `deregisterBrand`
- All scheduling, op queue, event, observability, workflow, festival tools — unchanged
- BLUME standalone MCP server — unchanged, runs independently
- `/brands/*.json` files on disk — unchanged, both systems read from the same directory
- `/vaults/` directory — unchanged
- Supabase tables — unchanged
- terravian-mcp daemon behavior — unchanged

---

## 3. How to Verify BLUME Standalone Still Works

Run the BLUME smoke test:

```bash
cd C:/dev/active/blume
node smoke-test.mjs
```

Expected output — all 5 checks must pass:
```
✓ Server starts without crashing  — [blume] v1.0.0 online...
✓ Tool list registered  — 5 core tools confirmed
✓ blume_list_brands  — 26 brands — 121212black,121212community,...
✓ blume_generate_post  — "<generated content>..."
✓ No terravian-mcp imports at runtime
```

If any check fails: BLUME standalone is broken independently of the bridge. Fix before proceeding.

---

## 4. How to Verify terravian-mcp Still Works

**Build check:**
```bash
cd C:/dev/active/terravian-mcp
npm run build
# Must exit with no errors and no TypeScript diagnostics
```

**Server start check:**
```bash
cd C:/dev/active/terravian-mcp
node dist/server.js
# Must print: [terravian-mcp] ... BLUME is online. Scheduler daemon active.
# Must not print any import errors for @terravian/blume
```

**Adapter import check (quick):**
```bash
cd C:/dev/active/terravian-mcp
node --input-type=module <<'EOF'
import { listBrands } from "@terravian/blume";
const brands = await listBrands();
console.log(`OK: ${brands.length} brands`);
EOF
# Expected: OK: 26 brands
```

---

## 5. How to Manually Test `blume_list_brands`

### Via BLUME standalone MCP (mcp__blume__)

In Claude Code, call:
```
mcp__blume__blume_list_brands
```
Arguments: `{}`

### Via terravian-mcp (mcp__terravian-mcp__)

In Claude Code, call:
```
mcp__terravian-mcp__blume_list_brands
```
Arguments: `{}`

Both calls must return the same brand list. The terravian-mcp call now routes through `@terravian/blume` internally.

---

## 6. Expected Output: 26 Brands

Both MCP servers must return all 26 of the following slugs (order may vary):

```
121212black, 121212community, 121212events, 121212reviews, 911today,
crownstrike, festivalcalendar, forbiddengnosis, fpwds, hhctravel,
launchpad18, mmhw-coaching, mmhw-institute, mrmetaphysical, mysports,
nooworld-login, ownthehour, otmgpt, relationshipgoals, sagaofpolarity,
stepleague, supportgroups, thenooworld, trpsh, winthehour,
crystallizedlovers
```

Response shape:
```json
{
  "count": 26,
  "brands": ["121212black", "121212community", ...]
}
```

If count differs from 26: check the `/brands/*.json` directory for missing or extra files.

---

## 7. Known Risk: npm link Dependency

The bridge currently depends on `npm link`, which is a local symlink — not a real npm install.

**Risks of npm link:**

| Risk | Likelihood | Impact |
|---|---|---|
| Symlink broken after `npm install` in terravian-mcp | Medium | `@terravian/blume` import fails at runtime |
| BLUME `dist/` is out of date (not rebuilt after source changes) | Medium | terravian-mcp gets stale BLUME logic |
| Node.js version mismatch between linked package and consumer | Low | Module resolution errors |
| npm link lost after machine restart or npm cache clear | Low | Import fails silently |

**How to check if the link is still active:**
```bash
ls C:/dev/active/terravian-mcp/node_modules/@terravian/blume/dist/index.js
# Must exist. If missing, re-run: npm link in blume/, then npm link @terravian/blume in terravian-mcp/
```

**How to re-establish the link if broken:**
```bash
cd C:/dev/active/blume
npm run build
npm link

cd C:/dev/active/terravian-mcp
npm link @terravian/blume
npm run build
```

---

## 8. Production Note

`npm link` is a development-only mechanism. Before deploying terravian-mcp to any production environment:

**Option A — npm install from GitHub:**
```json
// terravian-mcp/package.json
{
  "dependencies": {
    "@terravian/blume": "github:HouseofTerravian/blume#main"
  }
}
```
```bash
npm install
```

**Option B — npm publish (private or public registry):**
```bash
# In blume/
npm publish

# In terravian-mcp/
npm install @terravian/blume@1.0.0
```

**Option C — Return to local import (rollback):**
If production deployment is needed before BLUME is published, roll back this tool to the local import (see Section 9).

Do not ship `npm link` to production. It will not survive a fresh `npm install`.

---

## 9. Rollback Steps

Complete rollback of the baby bridge for `blume_list_brands`:

```bash
# Step 1: Revert the case block in terravian-mcp/src/server.ts
# Find:
#   const brands = await blumeListBrandsAdapter();
# Replace with:
#   const brands = getBrands();

# Step 2: Remove the adapter import from server.ts
# Delete this line:
#   import { blumeListBrandsAdapter } from "./adapters/blume.js";

# Step 3: Rebuild
cd C:/dev/active/terravian-mcp
npm run build

# Step 4 (optional): Remove the adapter file
# rm src/adapters/blume.ts

# Step 5 (optional): Unlink the package
cd C:/dev/active/terravian-mcp
npm unlink @terravian/blume
```

**What rollback does NOT affect:**
- BLUME standalone — unaffected entirely
- All other terravian-mcp tools — unaffected
- Brand JSON files on disk — unaffected
- Vault files on disk — unaffected
- Supabase data — unaffected

Rollback time: under 2 minutes.

---

## 10. Decision Gate — Before Migrating Tool #2

Do not proceed to migrate any additional tool until every item below is confirmed:

| Gate | Check | Confirmed? |
|---|---|---|
| G1 | Claude Code restarted and both MCP servers loaded without error | ☐ |
| G2 | `mcp__blume__blume_list_brands` returns 26 brands | ☐ |
| G3 | `mcp__terravian-mcp__blume_list_brands` returns 26 brands | ☐ |
| G4 | Both counts match each other and the `/brands/` directory | ☐ |
| G5 | No import errors appear in either server's stderr on startup | ☐ |
| G6 | BLUME smoke test (`node smoke-test.mjs`) passes 5/5 | ☐ |
| G7 | terravian-mcp build is clean (`npm run build` exits 0) | ☐ |
| G8 | All current work is committed and pushed in both repos | ☐ |
| G9 | npm link is confirmed active (dist/index.js resolves from terravian-mcp) | ☐ |
| G10 | Production deployment path for `@terravian/blume` is decided (npm link is NOT acceptable for prod) | ☐ |

**All 10 gates must be checked before tool #2 migration begins.**

Next candidate tool after gate confirmation: `blume_vault_summary`
See `docs/phase-2-migration-plan.md` for full migration order.
