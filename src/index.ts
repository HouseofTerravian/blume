/**
 * BLUME Content + Listing Generator
 * Public-signal-to-output engine.
 *
 * Phase 1 exports: generation, SEO, brands, vault, festival pipeline.
 */

// Content generation
export { generatePost, generateAIDASequence, generateOffer, generateEmail, diagnoseBrand, analyzeSiteForBrand } from "./content/generator.js";
export { generateSEOContent, generateFestivalSEO } from "./content/seo.js";
export { getBlumeSystemPrompt, PLATFORM_LIMITS, resolvePublicMode, DEFAULT_MODE, PUBLIC_MODES, PRIVATE_MODES } from "./content/persona.js";
export { SEVEN_SWITCHES, diagnoseSwitchFromContext } from "./content/switches.js";
export type { BlumeMode, PostRequest, GeneratedPost } from "./content/persona.js";
export type { SwitchNumber, SalesSwitch } from "./content/switches.js";
export type { SEOContent } from "./content/seo.js";
export type { SiteAnalysis, StrategicInsight } from "./content/analyzer.js";

// Brands
export { loadBrand, listBrands, loadAllBrands, addBrand, removeBrand } from "./brands/registry.js";
export type { BrandProfile } from "./brands/types.js";

// Vault
export { initBrandVaults, saveToVault, readVault, logPost, logCommerceEvent, logProofOfUse, searchVaults, getBrandVaultSummary } from "./vault/index.js";
export { VAULT_NAMES, VAULT_DESCRIPTIONS } from "./vault/types.js";
export type { VaultNumber, VaultEntry } from "./vault/types.js";

// Festival pipeline
export { ingestFestivals, dedupFestivalBatch, generateFestivalPageSEO, publishFestival } from "./listings/festivals/pipeline.js";
export type { FestivalInput, FestivalRecord, FestivalFilters, FestivalCategory, FestivalStatus } from "./listings/festivals/types.js";

// Listing types
export type { VerticalType, ListingInput, ListingRecord } from "./listings/types.js";

// Signals (Phase 2 stubs)
export type { SignalInput, SignalResult, SourceType } from "./signals/types.js";
