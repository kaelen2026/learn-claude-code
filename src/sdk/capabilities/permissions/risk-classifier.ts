import type { ToolDefinition } from '../../shared/types.js';
import { commandTouchesSensitiveEnv } from './sensitive-access.js';

export type PermissionMode = 'default' | 'plan' | 'auto';
export type PermissionBehavior = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  tool: string;
  behavior: PermissionBehavior;
  path?: string;
  content?: string;
}

export interface PermissionDecision {
  behavior: PermissionBehavior;
  reason: string;
}

export function classifyToolRisk(
  tool: ToolDefinition,
  input: Record<string, unknown>,
): 'read' | 'write' | 'high' {
  if (tool.riskLevel) return tool.riskLevel;

  if (tool.name === 'bash') {
    const command = String(input.command || '');
    if (
      command.includes('sudo') ||
      command.includes('rm -rf') ||
      commandTouchesSensitiveEnv(command)
    ) {
      return 'high';
    }
    return 'write';
  }

  if (
    tool.name.startsWith('read_') ||
    tool.name.startsWith('list_') ||
    tool.name === 'search_memory' ||
    tool.name === 'check_background' ||
    tool.name === 'task_get' ||
    tool.name === 'task_list' ||
    tool.name === 'cron_list'
  ) {
    return 'read';
  }

  return 'write';
}

export function globMatch(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

  try {
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(text);
  } catch {
    return false;
  }
}
