import type { SignalInput, SignalResult } from "./types.js";
export declare function ingestSignal(_input: SignalInput): Promise<SignalResult>;
export declare function listSignals(_filters: {
    brand?: string;
    source?: string;
    vertical?: string;
    limit?: number;
}): Promise<SignalResult[]>;
export type { SignalInput, SignalResult };
//# sourceMappingURL=index.d.ts.map