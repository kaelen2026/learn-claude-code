import { describe, expect, it, vi } from 'vitest';
import { SubagentManager } from './subagent-manager.js';

describe('SubagentManager', () => {
  function createManager(response = 'mock response') {
    const runner = vi.fn().mockResolvedValue(response);
    const manager = new SubagentManager(runner);
    return { manager, runner };
  }

  describe('run', () => {
    it('calls runner with task as prompt', async () => {
      const { manager, runner } = createManager('The answer is 42');
      const result = await manager.run('What is the meaning of life?');

      expect(runner).toHaveBeenCalledOnce();
      expect(runner.mock.calls[0][0]).toContain('What is the meaning of life?');
      expect(result.result).toBe('The answer is 42');
    });

    it('includes context in prompt when provided', async () => {
      const { manager, runner } = createManager('done');
      await manager.run('Summarize this', 'some context here');

      const prompt = runner.mock.calls[0][0];
      expect(prompt).toContain('Summarize this');
      expect(prompt).toContain('some context here');
    });

    it('assigns incrementing IDs', async () => {
      const { manager } = createManager();
      const r1 = await manager.run('task 1');
      const r2 = await manager.run('task 2');

      expect(r1.id).toBe(1);
      expect(r2.id).toBe(2);
    });

    it('records task name in result', async () => {
      const { manager } = createManager();
      const result = await manager.run('do something');
      expect(result.task).toBe('do something');
    });

    it('tracks duration', async () => {
      const runner = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 10)));
      const manager = new SubagentManager(runner);
      const result = await manager.run('slow task');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('stores result for later listing', async () => {
      const { manager } = createManager('result A');
      await manager.run('task A');
      const results = manager.listResults();
      expect(results).toHaveLength(1);
      expect(results[0].result).toBe('result A');
    });
  });

  describe('listResults', () => {
    it('returns empty array initially', () => {
      const { manager } = createManager();
      expect(manager.listResults()).toEqual([]);
    });

    it('returns all completed results', async () => {
      const runner = vi.fn().mockResolvedValueOnce('result 1').mockResolvedValueOnce('result 2');
      const manager = new SubagentManager(runner);

      await manager.run('task 1');
      await manager.run('task 2');

      const results = manager.listResults();
      expect(results).toHaveLength(2);
      expect(results[0].task).toBe('task 1');
      expect(results[1].task).toBe('task 2');
    });

    it('returns a copy, not a reference', async () => {
      const { manager } = createManager();
      await manager.run('task');
      const a = manager.listResults();
      const b = manager.listResults();
      expect(a).not.toBe(b);
    });
  });
});
