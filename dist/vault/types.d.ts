export type VaultNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export declare const VAULT_NAMES: Record<VaultNumber, string>;
export declare const VAULT_DESCRIPTIONS: Record<VaultNumber, string>;
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
//# sourceMappingURL=types.d.ts.map