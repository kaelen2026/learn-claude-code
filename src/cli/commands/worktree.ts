import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';
import { WorktreeStore } from '../../sdk/stores/worktrees/worktree-store.js';
import { WorktreeManager } from '../../sdk/capabilities/worktrees/worktree-manager.js';

export async function runWorktreeCommand(argv: string[]) {
  const [subcommand = 'list', ...rest] = argv;
  const workspaceStore = createWorkspaceStore(process.cwd());
  await workspaceStore.init();
  const manager = new WorktreeManager(
    new WorktreeStore(workspaceStore.paths.worktreesDir),
    workspaceStore.paths.worktreesDir
  );

  switch (subcommand) {
    case 'list': {
      const worktrees = await manager.list();
      if (worktrees.length === 0) {
        console.log('当前没有工作树');
        return;
      }
      for (const worktree of worktrees) {
        console.log(`${worktree.name} (${worktree.status}) -> ${worktree.path}`);
      }
      return;
    }
    case 'create': {
      const [name, taskIdRaw] = rest;
      if (!name) {
        console.error('请提供工作树名称，例如: npm start -- worktree create auth-refactor 1');
        process.exitCode = 1;
        return;
      }
      const record = await manager.create(
        name,
        taskIdRaw ? Number(taskIdRaw) : null
      );
      console.log(`工作树已创建: ${record.name} (${record.branch})`);
      return;
    }
    default:
      console.error(`未知 worktree 子命令: ${subcommand}`);
      process.exitCode = 1;
  }
}
