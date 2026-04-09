import type { MessageEnvelope, TeamMemberRecord } from '../../shared/types.js';
import type { TeamStore } from '../../stores/teams/team-store.js';
import type { MessageBus } from './message-bus.js';

export class TeamManager {
  constructor(
    private readonly teamStore: TeamStore,
    private readonly bus: MessageBus,
  ) {}

  async spawn(name: string, role: string): Promise<TeamMemberRecord> {
    const members = await this.teamStore.loadAll();
    const existing = members.find((member) => member.name === name);
    if (existing) return existing;
    const member: TeamMemberRecord = { name, role, status: 'idle' };
    members.push(member);
    await this.teamStore.saveAll(members);
    return member;
  }

  async listMembers(): Promise<TeamMemberRecord[]> {
    return this.teamStore.loadAll();
  }

  async sendMessage(from: string, to: string, content: string): Promise<void> {
    const envelope: MessageEnvelope = {
      type: 'message',
      from,
      content,
      timestamp: Date.now(),
    };
    await this.bus.send(to, envelope);
  }

  async runMemberLoop(name: string, task: string): Promise<string> {
    const members = await this.teamStore.loadAll();
    const member = members.find((item) => item.name === name);
    if (!member) return `成员 ${name} 不存在`;

    member.status = 'working';
    await this.teamStore.saveAll(members);

    const messages = await this.bus.readInbox(name);
    const context =
      messages.length > 0
        ? messages.map((message) => `[来自 ${message.from}]: ${message.content}`).join('\n')
        : '';

    const result = context
      ? `${name}(${member.role}) 完成任务: ${task}\n上下文:\n${context}`
      : `${name}(${member.role}) 完成任务: ${task}`;

    member.status = 'idle';
    await this.teamStore.saveAll(members);
    return result;
  }
}
