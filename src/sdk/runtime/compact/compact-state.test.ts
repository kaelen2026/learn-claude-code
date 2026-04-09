import { describe, expect, it } from 'vitest';
import { CompactState } from './compact-state.js';

describe('CompactState', () => {
  it('initializes with default values', () => {
    const state = new CompactState();
    expect(state.hasCompacted).toBe(false);
    expect(state.lastSummary).toBe('');
    expect(state.persistedOutputs).toEqual([]);
  });

  it('tracks persisted outputs with newest first', () => {
    const state = new CompactState();
    state.trackPersistedOutput('/a');
    state.trackPersistedOutput('/b');
    expect(state.persistedOutputs).toEqual(['/b', '/a']);
  });

  it('caps at 5 entries', () => {
    const state = new CompactState();
    for (let i = 0; i < 7; i++) {
      state.trackPersistedOutput(`/path${i}`);
    }
    expect(state.persistedOutputs).toHaveLength(5);
    expect(state.persistedOutputs[0]).toBe('/path6');
  });

  it('deduplicates entries', () => {
    const state = new CompactState();
    state.trackPersistedOutput('/a');
    state.trackPersistedOutput('/b');
    state.trackPersistedOutput('/a');
    expect(state.persistedOutputs).toEqual(['/a', '/b']);
  });
});
