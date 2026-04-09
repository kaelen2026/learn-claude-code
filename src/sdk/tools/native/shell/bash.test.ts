import { describe, expect, it } from 'vitest';
import { createBashTool } from './bash.js';

describe('bash tool', () => {
  const tool = createBashTool();

  it('has correct name and risk level', () => {
    expect(tool.name).toBe('bash');
    expect(tool.riskLevel).toBe('write');
  });

  it('returns real stdout from echo', async () => {
    const result = await tool.execute({ command: 'echo hello_world_test_42' });
    // Stub would return "[模拟同步] $ echo hello_world_test_42\n(ok)"
    // Real execution should return "hello_world_test_42\n"
    expect(result.trim()).toBe('hello_world_test_42');
  });

  it('returns real output from printf', async () => {
    const result = await tool.execute({ command: 'printf "abc123"' });
    expect(result).toBe('abc123');
  });

  it('captures multiline output', async () => {
    const result = await tool.execute({ command: 'printf "line1\\nline2\\nline3"' });
    const lines = result.trim().split('\n');
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });

  it('includes error info on failure', async () => {
    const result = await tool.execute({ command: 'false' });
    expect(result).toContain('exit');
  });

  it('captures pwd output', async () => {
    const result = await tool.execute({ command: 'pwd' });
    expect(result.trim().startsWith('/')).toBe(true);
  });
});
