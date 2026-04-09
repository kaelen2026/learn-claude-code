export interface RuntimeResult {
  outputText: string;
}

export interface RuntimeRecoveryStats {
  continuationAttempts: number;
  compactAttempts: number;
  transportAttempts: number;
}
