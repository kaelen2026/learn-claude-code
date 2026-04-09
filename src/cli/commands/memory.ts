import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';
import { MemoryStore } from '../../sdk/stores/memory/memory-store.js';
import { MemoryManager } from '../../sdk/capabilities/memory/memory-manager.js';

export async function runMemoryCommand(argv: string[]) {
  const [subcommand = 'list', ...rest] = argv;
  const workspaceStore = createWorkspaceStore(process.cwd());
  await workspaceStore.init();

  const manager = new MemoryManager(
    new MemoryStore(
      workspaceStore.paths.memoryDir,
      workspaceStore.paths.memoryEntriesDir
    )
  );

  switch (subcommand) {
    case 'list': {
      const entries = await manager.listAll();
      if (entries.length === 0) {
        console.log('当前没有存储的记忆');
        return;
      }
      for (const entry of entries) {
        console.log(`[${entry.type}] ${entry.name} (${entry.filename})`);
        console.log(`  ${entry.description}\n`);
      }
      return;
    }
    case 'search': {
      const query = rest.join(' ').trim();
      if (!query) {
        console.error('请提供搜索词，例如: npm start -- memory search "2 空格"');
        process.exitCode = 1;
        return;
      }
      const results = await manager.search(query);
      if (results.length === 0) {
        console.log(`未找到匹配 "${query}" 的记忆`);
        return;
      }
      for (const entry of results) {
        console.log(`[${entry.type}] ${entry.name} (${entry.filename})`);
        console.log(`  ${entry.description}`);
        console.log(`  ${entry.body.slice(0, 200)}\n`);
      }
      return;
    }
    default:
      console.error(`未知 memory 子命令: ${subcommand}`);
      process.exitCode = 1;
  }
}
