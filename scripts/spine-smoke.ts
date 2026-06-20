/* Spine smoke test — proves S1/S2 is sufficient for lotus_readiness. Run: tsx scripts/spine-smoke.ts */
import { createHash } from "crypto";
import { ingestArtifact, getArtifact, listArtifacts, versionArtifact } from "../src/artifacts/store.js";
import { validateRouterTag, toRouterTag } from "../src/artifacts/routerTag.js";
import { listVaultRegistry } from "../src/artifacts/registry.js";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };

const B = "spine-smoke-brand";

// 1. ingest
const { artifact: a, routerTag } = await ingestArtifact({ brand: B, title: "Hello", body: "hello", vault: "proof-of-use", switch: 3 });
ok(!!a.uuid && a.uuid.length >= 32, "ingest assigns a uuid");
ok(a.version === 1, "version starts at 1");
ok(a.source === "manual", "default source = manual");
ok(!!a.timestamp && !Number.isNaN(Date.parse(a.timestamp)), "timestamp assigned (ISO)");
ok(a.hash === createHash("sha256").update("hello").digest("hex"), "hash = sha256(body)");
ok(a.vault === "proof-of-use", "vault stored as canonical slug");

// 2. router-tag valid
ok(validateRouterTag(routerTag, { body: "hello" }).valid, "emitted router-tag validates (with hash check)");

// 3. list filters (the Lotus call)
ok((await listArtifacts({ brand: B })).some(x => x.uuid === a.uuid), "artifact_list(brand) returns it");
ok((await listArtifacts({ brand: B, vault: "proof-of-use" })).length >= 1, "filter by vault works");
ok((await listArtifacts({ brand: B, switch: 3 })).length >= 1, "filter by switch works");
ok((await listArtifacts({ brand: B, vault: "investor" })).every(x => x.vault === "investor"), "vault filter excludes others");

// 4. round-trip
const got = getArtifact(a.uuid, B);
ok(!!got && got.body === "hello" && got.hash === a.hash, "get(uuid) round-trips body + hash");

// 5. versioning (immutable original)
const v2 = await versionArtifact(a.uuid, "hello v2");
ok(v2.version === 2 && v2.parent_uuid === a.uuid, "version() → v2 with parent lineage");
ok(getArtifact(a.uuid, B)!.body === "hello", "original version untouched");
ok(v2.hash === createHash("sha256").update("hello v2").digest("hex"), "v2 hash recomputed");

// 6. validation rejects malformed
const bad = validateRouterTag({ brand: B, title: "x", vault: "not-a-vault", switch: 9, version: 0 } as any);
ok(!bad.valid && bad.errors.length >= 3, "malformed router-tag rejected with errors");

// 7. registry
ok(listVaultRegistry().length === 12, "vault registry has 12 entries");
ok(listVaultRegistry().find(v => v.slug === "brand-assets")?.doctrine_no === 1, "brand-assets = doctrine #1");

console.log(`\nSPINE SMOKE: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
