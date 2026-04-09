import type Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from '../shared/types.js';
import { executeToolWithGuards } from './tool-executor.js';
import type { PermissionGate } from '../capabilities/permissions/permission-gate.js';
import type { HookRunner } from '../capabilities/hooks/hook-runner.js';

export async function executeToolCall(
  tools: ToolDefinition[],
  block: Anthropic.ToolUseBlock,
  options: {
    permissionGate?: PermissionGate;
    hookRunner?: HookRunner;
  } = {}
): Promise<Anthropic.ToolResultBlockParam> {
  const tool = tools.find((item) => item.name === block.name);

  if (!tool) {
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: `错误: 未找到工具 "${block.name}"`,
      is_error: true,
    };
  }

  return executeToolWithGuards({
    tool,
    block,
    permissionGate: options.permissionGate,
    hookRunner: options.hookRunner,
  });
}
