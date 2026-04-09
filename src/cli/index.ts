import { runChatCommand } from './commands/chat.js';
import { runTaskCommand } from './commands/task.js';
import { runMemoryCommand } from './commands/memory.js';
import { runScheduleCommand } from './commands/schedule.js';
import { runTeamCommand } from './commands/team.js';
import { runWorktreeCommand } from './commands/worktree.js';
import { runMcpCommand } from './commands/mcp.js';

export async function runCli(argv: string[]) {
  const [command = 'chat', ...rest] = argv;

  switch (command) {
    case 'chat':
      await runChatCommand(rest);
      return;
    case 'task':
      await runTaskCommand(rest);
      return;
    case 'memory':
      await runMemoryCommand(rest);
      return;
    case 'schedule':
      await runScheduleCommand(rest);
      return;
    case 'team':
      await runTeamCommand(rest);
      return;
    case 'worktree':
      await runWorktreeCommand(rest);
      return;
    case 'mcp':
      await runMcpCommand(rest);
      return;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    default:
      console.error(`未知命令: ${command}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`Learn Claude Code Runtime CLI

用法:
  npm start -- chat "帮我解释这个项目"
  npm start -- task list
  npm start -- task create "补充 README 迁移说明"
  npm start -- memory list
  npm start -- memory search "偏好"
  npm start -- schedule list
  npm start -- schedule create "*/5 * * * *" "提醒我检查后台任务"
  npm start -- team list
  npm start -- worktree list
  npm start -- mcp list
  npm start -- help
`);
}
