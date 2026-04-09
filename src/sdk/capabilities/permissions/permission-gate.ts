import type { ToolDefinition } from '../../shared/types.js';
import { classifyToolRisk, type PermissionDecision, type PermissionMode, type PermissionRule } from './risk-classifier.js';
import { evaluatePermissionPolicy } from './policy-engine.js';

export class PermissionGate {
  private readonly rules: PermissionRule[] = [];
  private consecutiveDenials = 0;

  constructor(private mode: PermissionMode = 'default') {}

  addRule(rule: PermissionRule) {
    this.rules.push(rule);
  }

  setMode(mode: PermissionMode) {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  check(tool: ToolDefinition, params: Record<string, unknown>): PermissionDecision {
    const decision = evaluatePermissionPolicy({
      mode: this.mode,
      toolName: tool.name,
      params,
      risk: classifyToolRisk(tool, params),
      rules: this.rules,
    });

    if (decision.behavior === 'deny') {
      this.consecutiveDenials += 1;
    } else {
      this.consecutiveDenials = 0;
    }

    return decision;
  }

  async askUser(tool: ToolDefinition, params: Record<string, unknown>): Promise<{
    approved: boolean;
    alwaysAllow: boolean;
  }> {
    void params;

    if (this.mode === 'auto') {
      return { approved: true, alwaysAllow: false };
    }

    return {
      approved: true,
      alwaysAllow: tool.riskLevel !== 'high',
    };
  }
}
