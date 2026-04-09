import { describe, expect, it } from 'vitest';
import { evaluatePermissionPolicy } from './policy-engine.js';

describe('evaluatePermissionPolicy', () => {
  const base = {
    mode: 'default' as const,
    toolName: 'read_file',
    params: {},
    risk: 'read' as const,
    rules: [],
  };

  it('allows read operations by default', () => {
    const result = evaluatePermissionPolicy(base);
    expect(result.behavior).toBe('allow');
  });

  it('asks for write operations by default', () => {
    const result = evaluatePermissionPolicy({ ...base, toolName: 'save_memory', risk: 'write' });
    expect(result.behavior).toBe('ask');
  });

  it('asks for high risk operations', () => {
    const result = evaluatePermissionPolicy({ ...base, toolName: 'bash', risk: 'high' });
    expect(result.behavior).toBe('ask');
  });

  it('deny rules block immediately', () => {
    const result = evaluatePermissionPolicy({
      ...base,
      rules: [{ tool: '*', behavior: 'deny', path: '*.env*' }],
      params: { path: '.env.local' },
    });
    expect(result.behavior).toBe('deny');
  });

  it('deny rule with content match', () => {
    const result = evaluatePermissionPolicy({
      ...base,
      toolName: 'bash',
      risk: 'write',
      rules: [{ tool: 'bash', behavior: 'deny', content: 'rm -rf' }],
      params: { command: 'rm -rf /' },
    });
    expect(result.behavior).toBe('deny');
  });

  it('allow rules match for write operations', () => {
    const result = evaluatePermissionPolicy({
      ...base,
      toolName: 'save_memory',
      risk: 'write',
      rules: [{ tool: 'save_memory', behavior: 'allow' }],
    });
    expect(result.behavior).toBe('allow');
  });

  describe('plan mode', () => {
    it('allows read operations', () => {
      const result = evaluatePermissionPolicy({ ...base, mode: 'plan' });
      expect(result.behavior).toBe('allow');
    });

    it('denies write operations', () => {
      const result = evaluatePermissionPolicy({ ...base, mode: 'plan', risk: 'write' });
      expect(result.behavior).toBe('deny');
    });
  });

  describe('auto mode', () => {
    it('allows non-high operations', () => {
      const result = evaluatePermissionPolicy({ ...base, mode: 'auto', risk: 'write' });
      expect(result.behavior).toBe('allow');
    });

    it('asks for high risk even in auto mode', () => {
      const result = evaluatePermissionPolicy({ ...base, mode: 'auto', risk: 'high' });
      expect(result.behavior).toBe('ask');
    });
  });
});
