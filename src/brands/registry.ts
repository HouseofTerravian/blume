import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BrandProfile } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = path.resolve(__dirname, "../../brands");

const _cache: Map<string, BrandProfile> = new Map();

export function loadBrand(slug: string): BrandProfile {
  if (_cache.has(slug)) return _cache.get(slug)!;

  const filePath = path.join(BRANDS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Brand profile not found: ${slug}. Available: ${listBrands().join(", ")}`);
  }

  const profile = JSON.parse(fs.readFileSync(filePath, "utf-8")) as BrandProfile;
  _cache.set(slug, profile);
  return profile;
}

export function listBrands(): string[] {
  if (!fs.existsSync(BRANDS_DIR)) return [];
  return fs
    .readdirSync(BRANDS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(".json", ""));
}

export function loadAllBrands(): BrandProfile[] {
  return listBrands().map(loadBrand);
}

export function addBrand(profile: BrandProfile): void {
  const slug = profile.slug;
  if (!slug || typeof slug !== "string") {
    throw new Error("Brand profile must have a valid 'slug' field.");
  }

  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (safeSlug !== slug) {
    throw new Error(`Invalid slug "${slug}". Use only lowercase letters, numbers, and hyphens.`);
  }

  fs.mkdirSync(BRANDS_DIR, { recursive: true });
  const filePath = path.join(BRANDS_DIR, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");

  _cache.set(slug, profile);
}

export function removeBrand(slug: string): void {
  const filePath = path.join(BRANDS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Brand not found: ${slug}`);
  }

  fs.unlinkSync(filePath);
  _cache.delete(slug);
}
