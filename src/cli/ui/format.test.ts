import { describe, expect, it } from 'vitest';
import { formatToolInput, formatToolResult } from './format.js';

describe('formatToolInput', () => {
  it('returns empty string for empty input', () => {
    expect(formatToolInput({})).toBe('');
  });

  it('formats key=value pairs', () => {
    const result = formatToolInput({ path: '/src/index.ts' });
    expect(result).toBe('path=/src/index.ts');
  });

  it('truncates long values at 60 chars', () => {
    const longValue = 'a'.repeat(100);
    const result = formatToolInput({ key: longValue });
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(100);
  });

  it('shows max 2 entries with ellipsis', () => {
    const result = formatToolInput({ a: '1', b: '2', c: '3' });
    expect(result).toContain('...');
    expect(result).toContain('a=1');
    expect(result).toContain('b=2');
    expect(result).not.toContain('c=3');
  });

  it('serializes non-string values', () => {
    const result = formatToolInput({ count: 42 });
    expect(result).toBe('count=42');
  });
});

describe('formatToolResult', () => {
  it('returns short results unchanged', () => {
    expect(formatToolResult('hello')).toBe('hello');
  });

  it('truncates after maxLines', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n');
    const result = formatToolResult(lines, 3);
    expect(result).toContain('line 0');
    expect(result).toContain('line 2');
    expect(result).not.toContain('line 3');
    expect(result).toContain('7 more lines');
  });

  it('uses default 6 lines', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n');
    const result = formatToolResult(lines);
    expect(result).toContain('4 more lines');
  });
});
