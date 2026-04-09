import type { SkillManifest } from '../../shared/types.js';

export function parseSkillManifest(content: string): SkillManifest | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

  if (!name || !description) return null;
  return { name, description };
}
