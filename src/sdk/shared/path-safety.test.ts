import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { isPathWithinRoot, resolveWorkspacePath } from './path-safety.js';

describe('resolveWorkspacePath', () => {
  const root = '/workspace/project';

  it('resolves normal relative paths', async () => {
    const result = await resolveWorkspacePath(root, 'src/index.ts', 'file');
    expect(result.ok).toBe(true);
    expect(result.path).toBe('/workspace/project/src/index.ts');
  });

  it('resolves empty path to root', async () => {
    const result = await resolveWorkspacePath(root, '', 'directory');
    expect(result.ok).toBe(true);
    expect(result.path).toBe('/workspace/project');
  });

  it('blocks path traversal attacks', async () => {
    const result = await resolveWorkspacePath(root, '../../../etc/passwd', 'file');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('blocks relative parent escape', async () => {
    const result = await resolveWorkspacePath(root, '..', 'directory');
    expect(result.ok).toBe(false);
  });

  it('allows nested paths within workspace', async () => {
    const result = await resolveWorkspacePath(root, 'src/../src/index.ts', 'file');
    expect(result.ok).toBe(true);
  });

  it('blocks symlink escapes that point outside workspace', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'path-safety-'));
    const workspaceRoot = join(tempRoot, 'workspace');
    const outsideRoot = join(tempRoot, 'outside');
    mkdirSync(workspaceRoot, { recursive: true });
    mkdirSync(outsideRoot, { recursive: true });
    writeFileSync(join(outsideRoot, 'secret.txt'), 'shh', 'utf-8');
    symlinkSync(outsideRoot, join(workspaceRoot, 'linked-outside'));

    const result = await resolveWorkspacePath(workspaceRoot, 'linked-outside/secret.txt', 'file');
    expect(result.ok).toBe(false);
  });

  it('treats absolute relative-path results as outside the workspace', () => {
    expect(isPathWithinRoot('C:\\repo', 'D:\\secret', 'D:\\secret')).toBe(false);
  });

  it('treats different Windows drive roots as outside the workspace', () => {
    expect(isPathWithinRoot('C:\\repo', 'D:\\secret', 'secret')).toBe(false);
  });
});
