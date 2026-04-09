import { appendFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { MessageEnvelope } from '../../shared/types.js';

export class InboxStore {
  constructor(private readonly inboxDir: string) {}

  async send(to: string, envelope: MessageEnvelope): Promise<void> {
    await appendFile(join(this.inboxDir, `${to}.jsonl`), `${JSON.stringify(envelope)}\n`, 'utf-8');
  }

  async readInbox(name: string): Promise<MessageEnvelope[]> {
    const file = join(this.inboxDir, `${name}.jsonl`);
    if (!existsSync(file)) return [];
    const raw = await readFile(file, 'utf-8');
    await writeFile(file, '', 'utf-8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MessageEnvelope);
  }
}
