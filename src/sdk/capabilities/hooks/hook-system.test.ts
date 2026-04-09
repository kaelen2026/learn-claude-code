import { describe, expect, it, vi } from 'vitest';
import { HookRegistry } from './hook-registry.js';
import { HookRunner } from './hook-runner.js';

describe('HookRegistry', () => {
  it('registers and retrieves handlers', () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    registry.register('PreToolUse', 'test', handler);

    const handlers = registry.get('PreToolUse');
    expect(handlers).toHaveLength(1);
    expect(handlers[0].name).toBe('test');
  });

  it('returns empty array for unregistered events', () => {
    const registry = new HookRegistry();
    expect(registry.get('SessionStart')).toEqual([]);
  });

  it('supports multiple handlers per event', () => {
    const registry = new HookRegistry();
    registry.register('PreToolUse', 'a', vi.fn());
    registry.register('PreToolUse', 'b', vi.fn());
    expect(registry.get('PreToolUse')).toHaveLength(2);
  });
});

describe('HookRunner', () => {
  it('runs all handlers for an event', async () => {
    const registry = new HookRegistry();
    const handler = vi.fn().mockResolvedValue({ exitCode: 0, message: '' });
    registry.register('PreToolUse', 'test', handler);

    const runner = new HookRunner(registry);
    const results = await runner.run({ name: 'PreToolUse', payload: { tool_name: 'bash' } });

    expect(handler).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0].exitCode).toBe(0);
  });

  it('handles handler errors gracefully', async () => {
    const registry = new HookRegistry();
    registry.register('PreToolUse', 'broken', vi.fn().mockRejectedValue(new Error('fail')));

    const runner = new HookRunner(registry);
    const results = await runner.run({ name: 'PreToolUse', payload: {} });

    expect(results).toHaveLength(1);
    expect(results[0].exitCode).toBe(2);
  });

  it('handles handler timeout', async () => {
    const registry = new HookRegistry();
    registry.register(
      'PreToolUse',
      'slow',
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );

    const runner = new HookRunner(registry, 50);
    const results = await runner.run({ name: 'PreToolUse', payload: {} });

    expect(results).toHaveLength(1);
    expect(results[0].exitCode).toBe(2);
    expect(results[0].message).toContain('超时');
  });

  describe('aggregate', () => {
    const runner = new HookRunner(new HookRegistry());

    it('returns exitCode 0 for empty results', () => {
      expect(runner.aggregate([]).exitCode).toBe(0);
    });

    it('returns blocking result if any exitCode is 1', () => {
      const result = runner.aggregate([
        { exitCode: 0, message: '' },
        { exitCode: 1, message: 'blocked' },
        { exitCode: 2, message: 'injected' },
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.message).toBe('blocked');
    });

    it('concatenates exitCode 2 messages', () => {
      const result = runner.aggregate([
        { exitCode: 0, message: '' },
        { exitCode: 2, message: 'msg1' },
        { exitCode: 2, message: 'msg2' },
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.message).toContain('msg1');
      expect(result.message).toContain('msg2');
    });

    it('returns exitCode 0 when all pass', () => {
      const result = runner.aggregate([
        { exitCode: 0, message: '' },
        { exitCode: 0, message: '' },
      ]);
      expect(result.exitCode).toBe(0);
    });
  });
});
