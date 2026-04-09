import { describe, expect, it } from 'vitest';
import { resolveWorkspacePath } from './path-safety.js';

describe('resolveWorkspacePath', () => {
  const root = '/workspace/project';

  it('resolves normal relative paths', () => {
    const result = resolveWorkspacePath(root, 'src/index.ts', 'file');
    expect(result.ok).toBe(true);
    expect(result.path).toBe('/workspace/project/src/index.ts');
  });

  it('resolves empty path to root', () => {
    const result = resolveWorkspacePath(root, '', 'directory');
    expect(result.ok).toBe(true);
    expect(result.path).toBe('/workspace/project');
  });

  it('blocks path traversal attacks', () => {
    const result = resolveWorkspacePath(root, '../../../etc/passwd', 'file');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('blocks relative parent escape', () => {
    const result = resolveWorkspacePath(root, '..', 'directory');
    expect(result.ok).toBe(false);
  });

  it('allows nested paths within workspace', () => {
    const result = resolveWorkspacePath(root, 'src/../src/index.ts', 'file');
    expect(result.ok).toBe(true);
  });
});
