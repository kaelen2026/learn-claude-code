import { relative, resolve } from 'path';

export interface ResolvedWorkspacePath {
  ok: boolean;
  path?: string;
  error?: string;
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  requestedPath: string,
  kind: 'file' | 'directory',
): ResolvedWorkspacePath {
  const root = resolve(workspaceRoot);
  const normalizedInput = requestedPath.trim();
  const candidate = normalizedInput ? resolve(root, normalizedInput) : root;
  const relativePath = relative(root, candidate);

  if (relativePath.startsWith('..') || relativePath === '..') {
    return {
      ok: false,
      error: `不允许访问工作区外的${kind === 'file' ? '文件' : '目录'}: ${requestedPath}`,
    };
  }

  return { ok: true, path: candidate };
}
