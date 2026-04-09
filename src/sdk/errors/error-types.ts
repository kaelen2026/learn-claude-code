export interface RecoveryState {
  continuationAttempts: number;
  compactAttempts: number;
  transportAttempts: number;
}

export interface RecoveryDecision {
  kind: 'continue' | 'compact' | 'backoff' | 'fail';
  reason: string;
}

export const MAX_CONTINUATION = 3;
export const MAX_COMPACT = 2;
export const MAX_TRANSPORT_RETRY = 3;
