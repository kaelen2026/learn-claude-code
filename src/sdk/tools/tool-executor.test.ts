import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '../shared/types.js';
import { executeToolWithGuards } from './tool-executor.js';

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'test_tool',
    description: 'test',
    inputSchema: { type: 'object', properties: {} },
    execute: vi.fn().mockResolvedValue('tool output'),
    ...overrides,
  };
}

function makeBlock(name = 'test_tool', input = {}): Anthropic.ToolUseBlock {
  return { type: 'tool_use', id: 'call_1', name, input };
}

describe('executeToolWithGuards', () => {
  it('executes tool and returns result', async () => {
    const tool = makeTool();
    const outcome = await executeToolWithGuards({ tool, block: makeBlock() });

    expect(tool.execute).toHaveBeenCalledOnce();
    expect(outcome.toolResult.content).toBe('tool output');
    expect(outcome.toolResult.is_error).toBeUndefined();
  });

  it('returns error when tool throws', async () => {
    const tool = makeTool({ execute: vi.fn().mockRejectedValue(new Error('boom')) });
    const outcome = await executeToolWithGuards({ tool, block: makeBlock() });

    expect(outcome.toolResult.is_error).toBe(true);
    expect(outcome.toolResult.content).toContain('boom');
  });

  describe('permission gate', () => {
    it('blocks on deny decision', async () => {
      const tool = makeTool();
      const permissionGate = {
        check: vi.fn().mockReturnValue({ behavior: 'deny', reason: 'blocked' }),
        askUser: vi.fn(),
        addRule: vi.fn(),
      };

      const outcome = await executeToolWithGuards({
        tool,
        block: makeBlock(),
        permissionGate: permissionGate as any,
      });

      expect(outcome.toolResult.is_error).toBe(true);
      expect(outcome.toolResult.content).toContain('操作被拒绝');
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('asks user and proceeds on approval', async () => {
      const tool = makeTool();
      const permissionGate = {
        check: vi.fn().mockReturnValue({ behavior: 'ask', reason: 'need approval' }),
        askUser: vi.fn().mockResolvedValue({ approved: true, alwaysAllow: false }),
        addRule: vi.fn(),
      };

      const outcome = await executeToolWithGuards({
        tool,
        block: makeBlock(),
        permissionGate: permissionGate as any,
      });

      expect(permissionGate.askUser).toHaveBeenCalled();
      expect(outcome.toolResult.content).toBe('tool output');
    });

    it('blocks when user denies', async () => {
      const tool = makeTool();
      const permissionGate = {
        check: vi.fn().mockReturnValue({ behavior: 'ask', reason: 'need approval' }),
        askUser: vi.fn().mockResolvedValue({ approved: false, alwaysAllow: false }),
        addRule: vi.fn(),
      };

      const outcome = await executeToolWithGuards({
        tool,
        block: makeBlock(),
        permissionGate: permissionGate as any,
      });

      expect(outcome.toolResult.is_error).toBe(true);
      expect(outcome.toolResult.content).toContain('用户拒绝');
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('adds allow rule on alwaysAllow', async () => {
      const tool = makeTool();
      const permissionGate = {
        check: vi.fn().mockReturnValue({ behavior: 'ask', reason: '' }),
        askUser: vi.fn().mockResolvedValue({ approved: true, alwaysAllow: true }),
        addRule: vi.fn(),
      };

      await executeToolWithGuards({
        tool,
        block: makeBlock(),
        permissionGate: permissionGate as any,
      });

      expect(permissionGate.addRule).toHaveBeenCalledWith({
        tool: 'test_tool',
        behavior: 'allow',
      });
    });
  });

  describe('hook runner', () => {
    it('blocks when pre-hook returns exitCode 1', async () => {
      const tool = makeTool();
      const hookRunner = {
        run: vi.fn().mockResolvedValue([{ exitCode: 1, message: 'hook blocked' }]),
        aggregate: vi.fn().mockReturnValue({ exitCode: 1, message: 'hook blocked' }),
      };

      const outcome = await executeToolWithGuards({
        tool,
        block: makeBlock(),
        hookRunner: hookRunner as any,
      });

      expect(outcome.toolResult.is_error).toBe(true);
      expect(outcome.toolResult.content).toContain('hook blocked');
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('injects messages from pre-hook exitCode 2', async () => {
      const tool = makeTool();
      const hookRunner = {
        run: vi
          .fn()
          .mockResolvedValueOnce([{ exitCode: 2, message: 'injected msg' }])
          .mockResolvedValueOnce([{ exitCode: 0, message: '' }]),
        aggregate: vi
          .fn()
          .mockReturnValueOnce({ exitCode: 2, message: 'injected msg' })
          .mockReturnValueOnce({ exitCode: 0, message: '' }),
      };

      const outcome = await executeToolWithGuards({
        tool,
        block: makeBlock(),
        hookRunner: hookRunner as any,
      });

      expect(outcome.injectedMessages).toContain('injected msg');
      expect(outcome.toolResult.content).toBe('tool output');
    });
  });
});
