import { describe, expect, it } from 'vitest';
import type { RecoveryState } from './error-types.js';
import { injectContinuationReminder, selectRecovery } from './recover.js';

function freshState(): RecoveryState {
  return { continuationAttempts: 0, compactAttempts: 0, transportAttempts: 0 };
}

describe('selectRecovery', () => {
  it('returns continue for max_tokens', () => {
    const result = selectRecovery({ stopReason: 'max_tokens' }, freshState());
    expect(result.kind).toBe('continue');
  });

  it('fails after max continuation attempts', () => {
    const state = { ...freshState(), continuationAttempts: 3 };
    const result = selectRecovery({ stopReason: 'max_tokens' }, state);
    expect(result.kind).toBe('fail');
  });

  it('returns compact for context length errors', () => {
    for (const msg of ['prompt is too long', 'context_length_exceeded', 'too many tokens']) {
      const result = selectRecovery({ errorMessage: msg }, freshState());
      expect(result.kind).toBe('compact');
    }
  });

  it('fails after max compact attempts', () => {
    const state = { ...freshState(), compactAttempts: 2 };
    const result = selectRecovery({ errorMessage: 'context_length_exceeded' }, state);
    expect(result.kind).toBe('fail');
  });

  it('returns backoff for transient errors', () => {
    for (const msg of ['timeout', 'rate limit', '429', '503', 'overloaded', 'connection reset']) {
      const result = selectRecovery({ errorMessage: msg }, freshState());
      expect(result.kind).toBe('backoff');
    }
  });

  it('fails after max transport retries', () => {
    const state = { ...freshState(), transportAttempts: 3 };
    const result = selectRecovery({ errorMessage: '429 too many requests' }, state);
    expect(result.kind).toBe('fail');
  });

  it('fails on unknown errors', () => {
    const result = selectRecovery({ errorMessage: 'something weird' }, freshState());
    expect(result.kind).toBe('fail');
  });
});

describe('injectContinuationReminder', () => {
  it('returns a non-empty string', () => {
    expect(injectContinuationReminder().length).toBeGreaterThan(0);
  });
});
