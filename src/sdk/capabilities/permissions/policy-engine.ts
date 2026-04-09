import type { PermissionDecision, PermissionMode, PermissionRule } from './risk-classifier.js';
import { globMatch } from './risk-classifier.js';

export function evaluatePermissionPolicy(input: {
  mode: PermissionMode;
  toolName: string;
  params: Record<string, unknown>;
  risk: 'read' | 'write' | 'high';
  rules: PermissionRule[];
}): PermissionDecision {
  for (const rule of input.rules) {
    if (rule.behavior === 'deny' && matchesRule(rule, input.toolName, input.params)) {
      return { behavior: 'deny', reason: `命中拒绝规则: tool=${rule.tool}` };
    }
  }

  if (input.mode === 'plan') {
    return input.risk === 'read'
      ? { behavior: 'allow', reason: 'plan 模式：读操作自动放行' }
      : { behavior: 'deny', reason: `plan 模式下禁止非读操作: ${input.toolName}` };
  }

  if (input.mode === 'auto' && input.risk !== 'high') {
    return { behavior: 'allow', reason: 'auto 模式：安全操作自动放行' };
  }

  if (input.risk === 'high') {
    return { behavior: 'ask', reason: `高风险操作需要确认: ${input.toolName}` };
  }

  for (const rule of input.rules) {
    if (rule.behavior === 'allow' && matchesRule(rule, input.toolName, input.params)) {
      return { behavior: 'allow', reason: `命中允许规则: tool=${rule.tool}` };
    }
  }

  if (input.risk === 'read') {
    return { behavior: 'allow', reason: '默认允许只读操作' };
  }

  return { behavior: 'ask', reason: `默认行为：需要确认 (${input.toolName})` };
}

function matchesRule(
  rule: PermissionRule,
  toolName: string,
  params: Record<string, unknown>,
): boolean {
  if (rule.tool !== '*' && !globMatch(rule.tool, toolName)) {
    return false;
  }

  if (rule.path) {
    const path = String(params.path || params.filename || '');
    if (!globMatch(rule.path, path)) {
      return false;
    }
  }

  if (rule.content) {
    if (!JSON.stringify(params).includes(rule.content)) {
      return false;
    }
  }

  return true;
}
