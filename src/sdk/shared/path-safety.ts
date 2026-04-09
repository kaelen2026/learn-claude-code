import { existsSync } from 'fs';
import { realpath } from 'fs/promises';
import { dirname, relative, resolve } from 'path';

export interface ResolvedWorkspacePath {
  ok: boolean;
  path?: string;
  error?: string;
}

export async function resolveWorkspacePath(
  workspaceRoot: string,
  requestedPath: string,
  kind: 'file' | 'directory',
): Promise<ResolvedWorkspacePath> {
  const root = resolve(workspaceRoot);
  const rootRealPath = await resolveIfPossible(root);
  const normalizedInput = requestedPath.trim();
  const candidate = normalizedInput ? resolve(root, normalizedInput) : root;
  const comparisonTarget =
    candidate === root
      ? rootRealPath
      : existsSync(candidate)
        ? await resolveIfPossible(candidate)
        : await resolveIfPossible(dirname(candidate));
  const relativePath = relative(rootRealPath, comparisonTarget);

  if (relativePath.startsWith('..') || relativePath === '..') {
    return {
      ok: false,
      error: `不允许访问工作区外的${kind === 'file' ? '文件' : '目录'}: ${requestedPath}`,
    };
  }

  return { ok: true, path: candidate };
}

async function resolveIfPossible(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}
