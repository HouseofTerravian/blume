# LOTUS ENGINE — SPEC v1
**Date:** 2026-06-19 · **Status:** Specification (no code) · **System:** S4 Lotus Engine (Scoring & Readiness)
**Owner:** BLUME-MCP · **Ledger tasks:** BLUME-040, 041, 042, 043 (Wave 1) + 052, 053, 054, 055, 064 (Wave 2)
**Depends on:** the Artifact/Router-Tag Spine (`ARTIFACT_SPINE_SPEC_v1.md`) — Lotus reads artifacts, owns no storage of truth.
**Reads with:** `ARCHITECTURE.md`, `docs/doctrine/blume-q1-q2-q3-resolution.md` §Lotus.

---

## 0. Why this is the #2 leverage gap (validation of the Coverage Report)

**Claim:** the Lotus Engine is the second highest-leverage missing system.

**Evidence it is missing (from as-built code):** there is **no scoring, readiness, health, or tick-map** logic or table anywhere in `blume/` or `terravian-mcp/`. `analytics_summary` is ops telemetry, not Lotus. The Launch Readiness Index, Health Bar, Tick Maps, and C/A/O/P/M scoring described in doctrine are entirely unbuilt.

**Evidence it is highest-leverage:** Lotus is the doctrine **keystone** — *"BLUME answers what should happen next."* That answer is **readiness-driven**: the Recommendation Engine (S5), Investor readiness (S10/S64), bottleneck-driven prompts, and Terravian-MCP prioritization all consume Lotus output. Without Lotus, BLUME can *generate* and *store* but cannot *judge* — which is the entire value proposition. It sits **directly atop the Spine** and unlocks the "intelligence" half of BLUME.

---

## 1. Responsibilities
1. Compute **five category sub-scores** for a brand, each 0–20: **Content · Audience · Offer · Proof · Monetization** (C/A/O/P/M).
2. Compute the **Launch Readiness Index** = Σ sub-scores → 0–100% with doctrine **bands**: `Go ≥85 · Final-Prep 70–84 · Structuring 50–69 · Dev <50`.
3. Produce the **Health Bar** (five segments + fill %).
4. **Missing-evidence detection** — which categories are empty/thin (and what artifact would fill them).
5. **Bottleneck detection** — the lowest-scoring category gating readiness.
6. **Tick Maps** — milestone ticks and their readiness contribution.
7. **Readiness summaries**, including an **investor-facing sanitized** variant.
8. Optionally persist **readiness snapshots** (as artifacts via the Spine) for history/trend.

## 2. Boundaries
**Owns:** the scoring rubric/config, the C/A/O/P/M computation, readiness %/band, Health Bar, missing-evidence, bottleneck, Tick Maps, readiness summaries.
**Does NOT own / do:**
- **Store truth** — Lotus reads artifacts via the Spine; it never edits source artifacts. (It MAY write its *own* readiness-snapshot artifacts with `source=system`.)
- **Generate content** → S17.
- **Recommend actions** → S5 Recommendation *consumes* Lotus but is separate ("score" ≠ "what to do").
- **Route / permission** → Terravian-MCP.
- **Be a vault.** Lotus is a framework *above* the vaults (doctrine). Tick Maps may live as artifacts in the `investor` vault, but **Lotus itself is not Vault 8.**
**Design note:** Lotus is **mostly stateless / derived** — it computes on read from current artifacts. Persistence is optional (snapshots for trend only).

## 3. Inputs
- **`brand`** (slug) → Lotus calls `artifact_list(brand, vault?, switch?)` on the Spine to gather that brand's artifacts.
- **Scoring config** — declarative rubric mapping each C/A/O/P/M category to its artifact **sources** (vaults + switches), counting/quality thresholds, and the 20-pt scale.
- **Optional time window** (score "as of" / within range).

**Reference category→source mapping (config v1, tunable in BLUME-040):**
| Category (0–20) | Primary artifact sources (vault / switch) |
|---|---|
| **Content** | vaults `published-works`, `creative-drafts`; switch 3 (Traffic) |
| **Audience** | switch 2 (Audience); proof of reach/followers in `proof-of-use` |
| **Offer** | `commerce-evidence` offers; switch 5 (Conversion) |
| **Proof** | `proof-of-use`, `commerce-evidence` (testimonials, first-use, receipts) |
| **Monetization** | `commerce-evidence`, `investor` (revenue, transactions, funding) |

## 4. Outputs
- **`readiness(brand)`** → `{ percent, band, subScores:{content,audience,offer,proof,monetization}, generatedAt }`
- **`healthBar(brand)`** → `{ segments:[{category, fill%}], overallFill% }`
- **`missingEvidence(brand)`** → `[{ category, severity, suggestedArtifact }]`
- **`bottleneck(brand)`** → `{ category, score, gapToNextBand }`
- **`tickMap(brand)`** → `[{ milestone, achieved:bool, contribution }]`
- **`investorSummary(brand)`** → sanitized narrative + percent + band (excludes `internal-notes` / `legal`).
- **Optional `snapshot`** → a persisted readiness artifact (history/trend).

## 5. MCP Tools
| Tool | Purpose | Args | Returns |
|---|---|---|---|
| `lotus_readiness` | Launch Readiness Index + band + 5 sub-scores | brand, as_of? | readiness |
| `lotus_health_bar` | Segmented health bar data | brand | healthBar |
| `lotus_missing_evidence` | Empty/thin categories + what would fill them | brand | gaps[] |
| `lotus_bottleneck` | Lowest category gating readiness | brand | bottleneck |
| `lotus_tick_map` | Milestone ticks + contribution | brand | tickMap |
| `lotus_investor_summary` | Sanitized investor-facing readiness | brand | summary |
| `lotus_score_config` | Inspect the active rubric (transparency) | — | config |
| `lotus_snapshot` | Persist a readiness snapshot artifact (history) | brand | artifact ref |

## 6. Database Structures (mostly derived; persistence optional)
Lotus is **computed on read** — minimal storage.
**`thq_lotus_config`** (or a versioned config file) — the rubric:
```
key              text PK     -- "v1"
categories       jsonb       -- [{name, max:20, sources:[{vault|switch, weight, thresholds}]}]
bands            jsonb       -- [{name:"Go", min:85}, {name:"Final-Prep", min:70}, ...]
active           bool
```
**`thq_readiness_snapshots`** (optional — trend/history only; NOT the source of truth):
```
id           uuid PK
brand        text   (idx)
percent      numeric
band         text
sub_scores   jsonb
generated_at timestamptz
```
**Tick Maps:** persisted (if at all) as **artifacts** via the Spine (`vault=investor` or `internal-notes`, `source=system`) — *Lotus is not a vault.*

## 7. Success Criteria
1. `lotus_readiness(brand)` returns a **deterministic** percent + band computed from that brand's artifacts (same artifacts → same score).
2. Bands exactly match doctrine: `Go ≥85 / Final-Prep 70–84 / Structuring 50–69 / Dev <50`.
3. Each sub-score is 0–20 and traces to named artifact sources (rubric is inspectable via `lotus_score_config`).
4. `lotus_missing_evidence` correctly flags empty/thin categories; `lotus_bottleneck` returns the true lowest category — both verifiable with seeded artifacts.
5. **Live recompute:** ingesting a new artifact changes readiness on the next call with no manual refresh.
6. `lotus_investor_summary` never leaks `internal-notes` or `legal` content.
7. Works across all **26 registered brands** without per-brand code.
8. **Dependency proof:** Lotus consumes the Spine's `artifact_list` and nothing else for truth — confirming the build order **Spine → Lotus**. If the Spine isn't built, Lotus cannot be correct.

---

## Closing: the two-system leverage thesis, proven
- **Spine** = the substrate every artifact and every MCP-boundary message flows through (router-tag IS the interface).
- **Lotus** = the keystone that turns stored truth into judgment ("what next").
- Confirmed missing in code; confirmed that S5 (Recommendation), S10 (Investor), S12 (Audit), S13 (Publishing proof), and S15 (Routing) **all depend on one or both.**
- **Forced order:** `Artifact Spine → Lotus Engine → everything else.` The Coverage Report's claim holds.
