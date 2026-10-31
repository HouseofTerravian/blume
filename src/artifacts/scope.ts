/**
 * Institutional scopes — artifact "brands" that belong to the House itself, not a commercial brand.
 * Reserved: they cannot be created as brand profiles, and artifacts may be written to them only
 * by internal institutional writers (e.g. the TPIG raw-signal envelope), never via `artifact_ingest`.
 */

export const INSTITUTIONAL_SCOPES: readonly string[] = ["house"];

export function isInstitutionalScope(slug: string): boolean {
  return INSTITUTIONAL_SCOPES.includes(slug);
}
