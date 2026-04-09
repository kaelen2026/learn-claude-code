import { MessageBus } from '../../sdk/capabilities/subagents/message-bus.js';
import { TeamManager } from '../../sdk/capabilities/subagents/team-manager.js';
import { InboxStore } from '../../sdk/stores/teams/inbox-store.js';
import { TeamStore } from '../../sdk/stores/teams/team-store.js';
import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';

export async function runTeamCommand(argv: string[]) {
  const [subcommand = 'list', ...rest] = argv;
  const workspaceStore = createWorkspaceStore(process.cwd());
  await workspaceStore.init();
  const manager = new TeamManager(
    new TeamStore(workspaceStore.paths.teamsDir),
    new MessageBus(new InboxStore(workspaceStore.paths.teamsInboxDir)),
  );

  switch (subcommand) {
    case 'list': {
      const members = await manager.listMembers();
      if (members.length === 0) {
        console.log('团队为空');
        return;
      }
      for (const member of members) {
        console.log(`${member.name} (${member.role}) - ${member.status}`);
      }
      return;
    }
    case 'spawn': {
      const [name, role] = rest;
      if (!name || !role) {
        console.error('请提供成员名和角色，例如: npm start -- team spawn alice reviewer');
        process.exitCode = 1;
        return;
      }
      const member = await manager.spawn(name, role);
      console.log(`团队成员已创建: ${member.name} (${member.role})`);
      return;
    }
    default:
      console.error(`未知 team 子命令: ${subcommand}`);
      process.exitCode = 1;
  }
}
