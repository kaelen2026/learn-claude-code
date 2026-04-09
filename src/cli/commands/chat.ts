import { createAgentRuntime } from '../../sdk/runtime/agent-runtime.js';
import { createDefaultToolRegistry } from '../../sdk/tools/tool-registry.js';
import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';
import { printAssistantMessage } from '../ui/console.js';

export async function runChatCommand(argv: string[]) {
  const prompt = argv.join(' ').trim();

  if (!prompt) {
    console.error('请提供一条用户消息，例如: npm start -- chat "帮我概览仓库结构"');
    process.exitCode = 1;
    return;
  }

  const store = createWorkspaceStore(process.cwd());
  await store.init();
  const toolBundle = await createDefaultToolRegistry({
    workspaceRoot: process.cwd(),
    memoryDir: store.paths.memoryDir,
    memoryEntriesDir: store.paths.memoryEntriesDir,
    tasksDir: store.paths.tasksDir,
    backgroundTasksDir: store.paths.backgroundTasksDir,
    backgroundOutputDir: store.paths.backgroundOutputDir,
    schedulesDir: store.paths.schedulesDir,
    teamsDir: store.paths.teamsDir,
    teamsInboxDir: store.paths.teamsInboxDir,
    worktreesDir: store.paths.worktreesDir,
  });

  const runtime = createAgentRuntime({
    workspaceStore: store,
    toolRegistry: toolBundle.registry,
    backgroundManager: toolBundle.backgroundManager,
    scheduleManager: toolBundle.scheduleManager,
    permissionGate: toolBundle.permissionGate,
    hookRunner: toolBundle.hookRunner,
    autonomousController: toolBundle.autonomousController,
  });

  const result = await runtime.run(prompt);
  printAssistantMessage(result.outputText);
}
