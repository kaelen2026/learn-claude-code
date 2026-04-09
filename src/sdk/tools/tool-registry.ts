import { AutonomousController } from '../capabilities/autonomy/autonomous-controller.js';
import { BackgroundManager } from '../capabilities/background/background-manager.js';
import { NotificationQueue } from '../capabilities/background/notification-queue.js';
import type { HookHandler } from '../capabilities/hooks/hook-registry.js';
import { HookRegistry } from '../capabilities/hooks/hook-registry.js';
import { HookRunner } from '../capabilities/hooks/hook-runner.js';
import { MemoryManager } from '../capabilities/memory/memory-manager.js';
import { PermissionGate } from '../capabilities/permissions/permission-gate.js';
import { ScheduleManager } from '../capabilities/scheduling/schedule-manager.js';
import { MessageBus } from '../capabilities/subagents/message-bus.js';
import { SubagentManager } from '../capabilities/subagents/subagent-manager.js';
import { TeamManager } from '../capabilities/subagents/team-manager.js';
import { TaskManager } from '../capabilities/tasks/task-manager.js';
import { WorktreeManager } from '../capabilities/worktrees/worktree-manager.js';
import type { ToolDefinition } from '../shared/types.js';
import { RuntimeTaskStore } from '../stores/background/runtime-task-store.js';
import { MemoryStore } from '../stores/memory/memory-store.js';
import { ScheduleStore } from '../stores/schedules/schedule-store.js';
import { TaskStore } from '../stores/tasks/task-store.js';
import { InboxStore } from '../stores/teams/inbox-store.js';
import { TeamStore } from '../stores/teams/team-store.js';
import { WorktreeStore } from '../stores/worktrees/worktree-store.js';
import { MCPClient } from './mcp/mcp-client.js';
import { MCPRegistry } from './mcp/mcp-registry.js';
import { createAssignWorkTool } from './native/agent/assign-work.js';
import { createListSubagentResultsTool } from './native/agent/list-results.js';
import { createListTeamTool } from './native/agent/list-team.js';
import { createSendMessageTool } from './native/agent/send-message.js';
import { createSpawnSubagentTool } from './native/agent/spawn-subagent.js';
import { createSpawnTeammateTool } from './native/agent/spawn-teammate.js';
import { createListFilesTool } from './native/fs/list-files.js';
import { createReadFileTool } from './native/fs/read-file.js';
import { createDeleteMemoryTool } from './native/memory/delete-memory.js';
import { createListMemoriesTool } from './native/memory/list-memories.js';
import { createSaveMemoryTool } from './native/memory/save-memory.js';
import { createSearchMemoryTool } from './native/memory/search-memory.js';
import { createCronCreateTool } from './native/schedule/cron-create.js';
import { createCronDeleteTool } from './native/schedule/cron-delete.js';
import { createCronListTool } from './native/schedule/cron-list.js';
import { createBackgroundRunTool } from './native/shell/background-run.js';
import { createBashTool } from './native/shell/bash.js';
import { createCheckBackgroundTool } from './native/shell/check-background.js';
import { createTaskCreateTool } from './native/task/task-create.js';
import { createTaskGetTool } from './native/task/task-get.js';
import { createTaskListTool } from './native/task/task-list.js';
import { createTaskUpdateTool } from './native/task/task-update.js';
import { createCloseoutWorktreeTool } from './native/worktree/closeout-worktree.js';
import { createCreateWorktreeTool } from './native/worktree/create-worktree.js';
import { createEnterWorktreeTool } from './native/worktree/enter-worktree.js';
import { createRunInWorktreeTool } from './native/worktree/run-in-worktree.js';

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export async function createDefaultToolRegistry(input: {
  workspaceRoot: string;
  memoryDir: string;
  memoryEntriesDir: string;
  tasksDir: string;
  backgroundTasksDir: string;
  backgroundOutputDir: string;
  schedulesDir: string;
  teamsDir: string;
  teamsInboxDir: string;
  worktreesDir: string;
}): Promise<{
  registry: ToolRegistry;
  backgroundManager: BackgroundManager;
  scheduleManager: ScheduleManager;
  permissionGate: PermissionGate;
  hookRunner: HookRunner;
  teamManager: TeamManager;
  subagentManager: SubagentManager;
  worktreeManager: WorktreeManager;
  mcpRegistry: MCPRegistry;
  autonomousController: AutonomousController;
}> {
  const registry = new ToolRegistry();
  registry.register(createReadFileTool(input.workspaceRoot));
  registry.register(createListFilesTool(input.workspaceRoot));

  const memoryManager = new MemoryManager(new MemoryStore(input.memoryDir, input.memoryEntriesDir));
  registry.register(createSaveMemoryTool(memoryManager));
  registry.register(createSearchMemoryTool(memoryManager));
  registry.register(createListMemoriesTool(memoryManager));
  registry.register(createDeleteMemoryTool(memoryManager));

  const taskManager = new TaskManager(new TaskStore(input.tasksDir));
  await taskManager.init();
  registry.register(createTaskCreateTool(taskManager));
  registry.register(createTaskUpdateTool(taskManager));
  registry.register(createTaskGetTool(taskManager));
  registry.register(createTaskListTool(taskManager));
  const autonomousController = new AutonomousController(taskManager);

  const backgroundQueue = new NotificationQueue();
  const backgroundManager = new BackgroundManager(
    new RuntimeTaskStore(input.backgroundTasksDir),
    input.backgroundOutputDir,
    backgroundQueue,
  );
  await backgroundManager.init();
  registry.register(createBackgroundRunTool(backgroundManager));
  registry.register(createCheckBackgroundTool(backgroundManager));
  registry.register(createBashTool());

  const scheduleQueue = new NotificationQueue();
  const scheduleManager = new ScheduleManager(new ScheduleStore(input.schedulesDir), scheduleQueue);
  await scheduleManager.init();
  registry.register(createCronCreateTool(scheduleManager));
  registry.register(createCronDeleteTool(scheduleManager));
  registry.register(createCronListTool(scheduleManager));

  const subagentManager = new SubagentManager();
  registry.register(createSpawnSubagentTool(subagentManager));
  registry.register(createListSubagentResultsTool(subagentManager));

  const teamManager = new TeamManager(
    new TeamStore(input.teamsDir),
    new MessageBus(new InboxStore(input.teamsInboxDir)),
  );
  registry.register(createSpawnTeammateTool(teamManager));
  registry.register(createSendMessageTool(teamManager));
  registry.register(createAssignWorkTool(teamManager));
  registry.register(createListTeamTool(teamManager));

  const worktreeManager = new WorktreeManager(
    new WorktreeStore(input.worktreesDir),
    input.worktreesDir,
  );
  registry.register(createCreateWorktreeTool(worktreeManager));
  registry.register(createEnterWorktreeTool(worktreeManager));
  registry.register(createRunInWorktreeTool(worktreeManager));
  registry.register(createCloseoutWorktreeTool(worktreeManager));

  const mcpRegistry = new MCPRegistry();
  const postgres = new MCPClient('postgres', 'npx @mcp/postgres');
  await postgres.connect();
  postgres.registerTool({
    name: 'query',
    description: '执行 SQL 查询',
    inputSchema: { sql: { type: 'string' } },
    risk: 'read',
  });
  postgres.registerTool({
    name: 'insert',
    description: '插入数据',
    inputSchema: { table: { type: 'string' }, data: { type: 'object' } },
    risk: 'write',
  });
  mcpRegistry.addClient(postgres);

  const github = new MCPClient('github', 'npx @mcp/github');
  await github.connect();
  github.registerTool({
    name: 'list_prs',
    description: '列出 PR',
    inputSchema: { repo: { type: 'string' } },
    risk: 'read',
  });
  github.registerTool({
    name: 'create_issue',
    description: '创建 Issue',
    inputSchema: { title: { type: 'string' } },
    risk: 'write',
  });
  mcpRegistry.addClient(github);

  for (const tool of mcpRegistry.getAllTools()) {
    registry.register(tool);
  }

  const permissionGate = new PermissionGate('default');
  permissionGate.addRule({
    tool: '*',
    behavior: 'deny',
    path: '*.env*',
  });
  permissionGate.addRule({
    tool: 'bash',
    behavior: 'deny',
    content: 'rm -rf',
  });

  const hookRegistry = new HookRegistry();
  hookRegistry.register('SessionStart', 'runtime-banner', async () => ({
    exitCode: 2,
    message: 'Runtime 已启动，权限和 hooks 控制平面已启用。',
  }));
  hookRegistry.register('PreToolUse', 'env-guard', sensitiveFileGuard);
  hookRegistry.register('PostToolUse', 'audit-log', auditLogHook);
  const hookRunner = new HookRunner(hookRegistry);

  return {
    registry,
    backgroundManager,
    scheduleManager,
    permissionGate,
    hookRunner,
    teamManager,
    subagentManager,
    worktreeManager,
    mcpRegistry,
    autonomousController,
  };
}

const sensitiveFileGuard: HookHandler = async (event) => {
  if (event.name !== 'PreToolUse') return { exitCode: 0, message: '' };
  const toolName = String(event.payload.tool_name || '');
  const input = (event.payload.input || {}) as Record<string, unknown>;
  const path = String(input.path || '');

  if (toolName === 'read_file' && path.toLowerCase().includes('.env')) {
    return {
      exitCode: 1,
      message: `⛔ Hook 阻止读取敏感文件: ${path}`,
    };
  }

  if (toolName === 'bash') {
    const command = String(input.command || '');
    if (command.includes('sudo')) {
      return {
        exitCode: 1,
        message: `⛔ Hook 阻止危险命令: ${command}`,
      };
    }
  }

  return { exitCode: 0, message: '' };
};

const auditLogHook: HookHandler = async (event) => {
  if (event.name !== 'PostToolUse') return { exitCode: 0, message: '' };
  const toolName = String(event.payload.tool_name || '');
  const duration = Number(event.payload.duration_ms || 0);
  const success = Boolean(event.payload.success);
  const icon = success ? '✅' : '❌';
  console.log(`  📋 ${icon} ${toolName} (${duration}ms)`);
  return { exitCode: 0, message: '' };
};
