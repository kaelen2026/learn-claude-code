import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from '../../shared/types.js';
import { classifyToolRisk, globMatch } from './risk-classifier.js';

function makeTool(name: string, riskLevel?: 'read' | 'write' | 'high'): ToolDefinition {
  return {
    name,
    description: '',
    riskLevel,
    inputSchema: { type: 'object', properties: {} },
    execute: async () => '',
  };
}

describe('classifyToolRisk', () => {
  it('returns custom riskLevel when set', () => {
    expect(classifyToolRisk(makeTool('anything', 'high'), {})).toBe('high');
    expect(classifyToolRisk(makeTool('anything', 'read'), {})).toBe('read');
  });

  it('classifies bash as write by default', () => {
    expect(classifyToolRisk(makeTool('bash'), { command: 'ls -la' })).toBe('write');
  });

  it('classifies bash with dangerous commands as high', () => {
    expect(classifyToolRisk(makeTool('bash'), { command: 'sudo rm -rf /' })).toBe('high');
    expect(classifyToolRisk(makeTool('bash'), { command: 'rm -rf /tmp' })).toBe('high');
  });

  it('classifies read-prefixed tools as read', () => {
    expect(classifyToolRisk(makeTool('read_file'), {})).toBe('read');
    expect(classifyToolRisk(makeTool('list_files'), {})).toBe('read');
    expect(classifyToolRisk(makeTool('search_memory'), {})).toBe('read');
    expect(classifyToolRisk(makeTool('task_list'), {})).toBe('read');
  });

  it('classifies unknown tools as write', () => {
    expect(classifyToolRisk(makeTool('save_memory'), {})).toBe('write');
    expect(classifyToolRisk(makeTool('custom_tool'), {})).toBe('write');
  });
});

describe('globMatch', () => {
  it('matches exact strings', () => {
    expect(globMatch('bash', 'bash')).toBe(true);
    expect(globMatch('bash', 'dash')).toBe(false);
  });

  it('matches wildcard patterns', () => {
    expect(globMatch('read_*', 'read_file')).toBe(true);
    expect(globMatch('read_*', 'write_file')).toBe(false);
    expect(globMatch('*', 'anything')).toBe(true);
  });

  it('matches complex patterns', () => {
    expect(globMatch('mcp__*__drop_*', 'mcp__db__drop_table')).toBe(true);
    expect(globMatch('mcp__*__drop_*', 'mcp__db__create_table')).toBe(false);
  });
});
