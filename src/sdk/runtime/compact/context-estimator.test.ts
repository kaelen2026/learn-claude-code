import { describe, expect, it } from 'vitest';
import { estimateContextSize } from './context-estimator.js';

describe('estimateContextSize', () => {
  it('returns 0 for empty array', () => {
    expect(estimateContextSize([])).toBe(0);
  });

  it('counts string content length', () => {
    const messages = [{ role: 'user' as const, content: 'hello' }];
    expect(estimateContextSize(messages)).toBe(5);
  });

  it('serializes non-string content', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'hi' }],
      },
    ];
    const result = estimateContextSize(messages);
    expect(result).toBe(JSON.stringify([{ type: 'text', text: 'hi' }]).length);
  });

  it('sums multiple messages', () => {
    const messages = [
      { role: 'user' as const, content: 'abc' },
      { role: 'assistant' as const, content: 'defgh' },
    ];
    expect(estimateContextSize(messages)).toBe(8);
  });
});
