import { readdir, readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { MemoryEntryRecord, MemoryType } from './memory-record.js';

const INDEX_LINE_CAP = 200;

export class MemoryStore {
  constructor(
    private readonly memoryDir: string,
    private readonly entriesDir: string
  ) {}

  async save(entry: Omit<MemoryEntryRecord, 'filename'>): Promise<MemoryEntryRecord> {
    const filename = `${entry.type}_${slugify(entry.name)}.md`;
    const filepath = join(this.entriesDir, filename);

    const content = [
      '---',
      `name: ${entry.name}`,
      `description: ${entry.description}`,
      `type: ${entry.type}`,
      '---',
      '',
      entry.body,
    ].join('\n');

    await writeFile(filepath, content, 'utf-8');

    const record: MemoryEntryRecord = { ...entry, filename };
    await this.rebuildIndex();
    return record;
  }

  async loadAll(): Promise<MemoryEntryRecord[]> {
    if (!existsSync(this.entriesDir)) return [];

    const files = await readdir(this.entriesDir);
    const entries: MemoryEntryRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const entry = await this.loadFile(file);
      if (entry) entries.push(entry);
    }

    return entries.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  async findByType(type: MemoryType): Promise<MemoryEntryRecord[]> {
    const entries = await this.loadAll();
    return entries.filter((entry) => entry.type === type);
  }

  async delete(filename: string): Promise<boolean> {
    const filepath = join(this.entriesDir, filename);
    if (!existsSync(filepath)) return false;
    await unlink(filepath);
    await this.rebuildIndex();
    return true;
  }

  async rebuildIndex(): Promise<void> {
    const entries = await this.loadAll();
    const lines = ['# Memory Index', ''];

    const groups = new Map<MemoryType, MemoryEntryRecord[]>();
    for (const entry of entries) {
      if (!groups.has(entry.type)) {
        groups.set(entry.type, []);
      }
      groups.get(entry.type)?.push(entry);
    }

    const labels: Record<MemoryType, string> = {
      user: '用户偏好',
      feedback: '反馈纠正',
      project: '项目决策',
      reference: '外部资源',
    };

    for (const [type, label] of Object.entries(labels) as Array<[MemoryType, string]>) {
      const items = groups.get(type) || [];
      if (items.length === 0) continue;
      lines.push(`## ${label}`);
      for (const item of items) {
        lines.push(`- [${item.name}](entries/${item.filename}) — ${item.description}`);
      }
      lines.push('');
    }

    await writeFile(
      join(this.memoryDir, 'MEMORY.md'),
      lines.slice(0, INDEX_LINE_CAP).join('\n'),
      'utf-8'
    );
  }

  private async loadFile(filename: string): Promise<MemoryEntryRecord | null> {
    const filepath = join(this.entriesDir, filename);
    if (!existsSync(filepath)) return null;

    const raw = await readFile(filepath, 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---\n*([\s\S]*)$/);
    if (!match) return null;

    const frontmatter = match[1];
    const body = match[2].trim();
    const name = extractField(frontmatter, 'name');
    const description = extractField(frontmatter, 'description');
    const type = extractField(frontmatter, 'type') as MemoryType | null;

    if (!name || !description || !type) return null;
    return { name, description, type, filename, body };
  }
}

function slugify(input: string): string {
  return input
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '')
    .slice(0, 40);
}

function extractField(text: string, field: string): string | null {
  const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}
