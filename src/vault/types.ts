export type VaultNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const VAULT_NAMES: Record<VaultNumber, string> = {
  1: "published-works",
  2: "proof-of-use",
  3: "commerce-evidence",
  4: "brand-assets",
  5: "legal-disclaimers",
  6: "creative-drafts",
  7: "internal-notes",
  8: "investment-funding",
};

export const VAULT_DESCRIPTIONS: Record<VaultNumber, string> = {
  1: "All released products, videos, PDFs, posts",
  2: "Screenshots, URLs, first-use logs, pre-launch evidence",
  3: "Sales reports, receipts, transaction screenshots",
  4: "Logos, color palettes, templates, brand guides",
  5: "Copyright statements, licensing, trademark searches",
  6: "Unreleased ideas, mockups, brainstorms",
  7: "Strategy notes, confidential decisions",
  8: "Crowdfunding proofs, equity docs, investor comms, traction reports",
};

export interface VaultEntry {
  id: string;
  vault: VaultNumber;
  brand: string;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
