/**
 * BLUME Content + Listing Generator
 * Public-signal-to-output engine.
 *
 * Phase 1 exports: generation, SEO, brands, vault, festival pipeline.
 */
// Content generation
export { generatePost, generateAIDASequence, generateOffer, generateEmail, diagnoseBrand, analyzeSiteForBrand } from "./content/generator.js";
export { generateSEOContent, generateFestivalSEO } from "./content/seo.js";
export { getBlumeSystemPrompt, PLATFORM_LIMITS } from "./content/persona.js";
export { SEVEN_SWITCHES, diagnoseSwitchFromContext } from "./content/switches.js";
// Brands
export { loadBrand, listBrands, loadAllBrands, addBrand, removeBrand } from "./brands/registry.js";
// Vault
export { initBrandVaults, saveToVault, readVault, logPost, logCommerceEvent, logProofOfUse, searchVaults, getBrandVaultSummary } from "./vault/index.js";
export { VAULT_NAMES, VAULT_DESCRIPTIONS } from "./vault/types.js";
// Festival pipeline
export { ingestFestivals, dedupFestivalBatch, generateFestivalPageSEO, publishFestival } from "./listings/festivals/pipeline.js";
//# sourceMappingURL=index.js.map