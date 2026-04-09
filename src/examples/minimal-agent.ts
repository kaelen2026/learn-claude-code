import { createAgentRuntime } from '../sdk/runtime/agent-runtime.js';
import { createWorkspaceStore } from '../sdk/stores/workspace-store.js';
import { createDefaultToolRegistry } from '../sdk/tools/tool-registry.js';

const workspaceStore = createWorkspaceStore(process.cwd());
await workspaceStore.init();
const toolBundle = await createDefaultToolRegistry({
  workspaceRoot: process.cwd(),
  memoryDir: workspaceStore.paths.memoryDir,
  memoryEntriesDir: workspaceStore.paths.memoryEntriesDir,
  tasksDir: workspaceStore.paths.tasksDir,
  backgroundTasksDir: workspaceStore.paths.backgroundTasksDir,
  backgroundOutputDir: workspaceStore.paths.backgroundOutputDir,
  schedulesDir: workspaceStore.paths.schedulesDir,
  teamsDir: workspaceStore.paths.teamsDir,
  teamsInboxDir: workspaceStore.paths.teamsInboxDir,
  worktreesDir: workspaceStore.paths.worktreesDir,
});

const runtime = createAgentRuntime({
  workspaceStore,
  toolRegistry: toolBundle.registry,
  backgroundManager: toolBundle.backgroundManager,
  scheduleManager: toolBundle.scheduleManager,
  permissionGate: toolBundle.permissionGate,
  hookRunner: toolBundle.hookRunner,
  autonomousController: toolBundle.autonomousController,
});

const result = await runtime.run('请概览当前仓库结构，并说明最重要的目录。');
console.log(result.outputText);
