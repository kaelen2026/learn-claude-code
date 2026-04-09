import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { SkillManifest } from '../../shared/types.js';
import { parseSkillManifest } from './frontmatter.js';

export class SkillRegistry {
  constructor(private readonly skillsDir: string) {}

  async discover(): Promise<SkillManifest[]> {
    if (!existsSync(this.skillsDir)) return [];

    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    const manifests: SkillManifest[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = join(this.skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(file)) continue;

      const content = await readFile(file, 'utf-8');
      const manifest = parseSkillManifest(content);
      if (manifest) manifests.push(manifest);
    }

    return manifests;
  }
}
