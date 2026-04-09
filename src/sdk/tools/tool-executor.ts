import type Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from '../shared/types.js';
import { normalizeToolResult } from './tool-result.js';
import type { PermissionGate } from '../capabilities/permissions/permission-gate.js';
import type { HookRunner } from '../capabilities/hooks/hook-runner.js';

export async function executeToolWithGuards(input: {
  tool: ToolDefinition;
  block: Anthropic.ToolUseBlock;
  permissionGate?: PermissionGate;
  hookRunner?: HookRunner;
}): Promise<Anthropic.ToolResultBlockParam> {
  const params = input.block.input as Record<string, unknown>;

  if (input.permissionGate) {
    const decision = input.permissionGate.check(input.tool, params);
    if (decision.behavior === 'deny') {
      return {
        type: 'tool_result',
        tool_use_id: input.block.id,
        content: `⛔ 操作被拒绝: ${decision.reason}`,
        is_error: true,
      };
    }

    if (decision.behavior === 'ask') {
      const { approved, alwaysAllow } = await input.permissionGate.askUser(input.tool, params);
      if (!approved) {
        return {
          type: 'tool_result',
          tool_use_id: input.block.id,
          content: `⛔ 用户拒绝了操作: ${input.tool.name}`,
          is_error: true,
        };
      }
      if (alwaysAllow) {
        input.permissionGate.addRule({ tool: input.tool.name, behavior: 'allow' });
      }
    }
  }

  if (input.hookRunner) {
    const preResults = await input.hookRunner.run({
      name: 'PreToolUse',
      payload: {
        tool_name: input.tool.name,
        input: params,
      },
    });
    const preAgg = input.hookRunner.aggregate(preResults);
    if (preAgg.exitCode === 1) {
      return {
        type: 'tool_result',
        tool_use_id: input.block.id,
        content: preAgg.message || `⛔ Hook 阻止了工具调用: ${input.tool.name}`,
        is_error: true,
      };
    }
  }

  const startedAt = Date.now();
  try {
    const result = await input.tool.execute(params);
    const duration = Date.now() - startedAt;

    if (input.hookRunner) {
      await input.hookRunner.run({
        name: 'PostToolUse',
        payload: {
          tool_name: input.tool.name,
          input: params,
          success: true,
          duration_ms: duration,
          result,
        },
      });
    }

    return {
      type: 'tool_result',
      tool_use_id: input.block.id,
      content: normalizeToolResult(result),
    };
  } catch (error) {
    const duration = Date.now() - startedAt;
    if (input.hookRunner) {
      await input.hookRunner.run({
        name: 'PostToolUse',
        payload: {
          tool_name: input.tool.name,
          input: params,
          success: false,
          duration_ms: duration,
          error: String(error),
        },
      });
    }

    return {
      type: 'tool_result',
      tool_use_id: input.block.id,
      content: `工具执行失败: ${String(error)}`,
      is_error: true,
    };
  }
}
