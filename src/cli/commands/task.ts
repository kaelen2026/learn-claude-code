import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';
import { TaskStore } from '../../sdk/stores/tasks/task-store.js';
import { TaskManager, formatTask } from '../../sdk/capabilities/tasks/task-manager.js';

export async function runTaskCommand(argv: string[]) {
  const [subcommand = 'list', ...rest] = argv;
  const workspaceStore = createWorkspaceStore(process.cwd());
  await workspaceStore.init();

  const manager = new TaskManager(new TaskStore(workspaceStore.paths.tasksDir));
  await manager.init();

  switch (subcommand) {
    case 'list': {
      const tasks = await manager.list();
      if (tasks.length === 0) {
        console.log('当前没有任务');
        return;
      }
      for (const task of tasks) {
        console.log(`${formatTask(task, manager)}\n`);
      }
      return;
    }
    case 'create': {
      const subject = rest.join(' ').trim();
      if (!subject) {
        console.error('请提供任务标题，例如: npm start -- task create "重构任务系统"');
        process.exitCode = 1;
        return;
      }
      const task = await manager.create(subject);
      console.log(`已创建任务 #${task.id}: ${task.subject}`);
      return;
    }
    default:
      console.error(`未知 task 子命令: ${subcommand}`);
      process.exitCode = 1;
  }
}
