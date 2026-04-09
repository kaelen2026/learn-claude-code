import { existsSync } from 'fs';
import { realpath } from 'fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'path';

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

  if (!isPathWithinRoot(rootRealPath, comparisonTarget, relativePath)) {
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

export function isPathWithinRoot(
  rootPath: string,
  targetPath: string,
  relativePath?: string,
): boolean {
  const computedRelative = relativePath ?? relative(rootPath, targetPath);
  if (isAbsolute(computedRelative)) {
    return false;
  }

  const rootVolume = extractVolume(rootPath);
  const targetVolume = extractVolume(targetPath);
  if (rootVolume && targetVolume && rootVolume !== targetVolume) {
    return false;
  }

  return !(computedRelative.startsWith('..') || computedRelative === '..');
}

function extractVolume(path: string): string | null {
  const driveMatch = /^[a-z]:/i.exec(path);
  if (driveMatch) {
    return driveMatch[0].toLowerCase();
  }

  const uncMatch = /^(\\\\[^\\]+\\[^\\]+)/.exec(path);
  if (uncMatch) {
    return uncMatch[1].toLowerCase();
  }

  return null;
}
