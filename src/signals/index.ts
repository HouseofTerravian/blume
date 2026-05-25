// Signal Intake Engine — Phase 2 stub.
// Will accept SERP, Google Events, Maps, YouTube, and News signals.

import type { SignalInput, SignalResult } from "./types.js";

export async function ingestSignal(_input: SignalInput): Promise<SignalResult> {
  throw new Error("Signal Intake Engine not yet implemented. Coming in Phase 2.");
}

export async function listSignals(_filters: {
  brand?: string;
  source?: string;
  vertical?: string;
  limit?: number;
}): Promise<SignalResult[]> {
  return [];
}

export type { SignalInput, SignalResult };
