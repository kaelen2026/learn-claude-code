import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { TeamMemberRecord } from './member-record.js';

export class TeamStore {
  constructor(private readonly teamsDir: string) {}

  private get membersFile(): string {
    return join(this.teamsDir, 'members.json');
  }

  async loadAll(): Promise<TeamMemberRecord[]> {
    if (!existsSync(this.membersFile)) return [];
    const raw = await readFile(this.membersFile, 'utf-8');
    return JSON.parse(raw) as TeamMemberRecord[];
  }

  async saveAll(members: TeamMemberRecord[]): Promise<void> {
    await writeFile(this.membersFile, JSON.stringify(members, null, 2), 'utf-8');
  }
}
