import { createAgentRuntime } from '../../sdk/runtime/agent-runtime.js';
import type { WorkspaceStore } from '../../sdk/stores/workspace-store.js';
import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';
import { createDefaultToolRegistry } from '../../sdk/tools/tool-registry.js';
import { createApprovalHandler } from '../ui/approval.js';
import { printAssistantMessage } from '../ui/console.js';
import { createInputHandler } from '../ui/input.js';
import { createRenderer } from '../ui/renderer.js';
import { colors, symbols } from '../ui/theme.js';
import { printHelp, printWelcomeBanner } from '../ui/welcome.js';

type ToolBundle = Awaited<ReturnType<typeof createDefaultToolRegistry>>;

export async function runChatCommand(argv: string[]) {
  const prompt = argv.join(' ').trim();

  if (prompt) {
    await runSingleShot(prompt);
  } else {
    await runInteractiveChat();
  }
}

/** 单次调用模式（向后兼容） */
async function runSingleShot(prompt: string) {
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

/** 交互式聊天循环 */
async function runInteractiveChat() {
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

  const { handler } = createRenderer();
  const inputHandler = createInputHandler();

  // 注入交互式权限审批
  toolBundle.permissionGate.setApprovalHandler(createApprovalHandler());

  const runtime = createAgentRuntime({
    workspaceStore: store,
    toolRegistry: toolBundle.registry,
    backgroundManager: toolBundle.backgroundManager,
    scheduleManager: toolBundle.scheduleManager,
    permissionGate: toolBundle.permissionGate,
    hookRunner: toolBundle.hookRunner,
    autonomousController: toolBundle.autonomousController,
    onUIEvent: handler,
  });

  printWelcomeBanner();
  await runtime.initSession();

  while (true) {
    const input = await inputHandler.prompt();
    if (input === null) continue;

    // 斜杠命令
    if (input === '/exit' || input === '/quit') {
      console.log(colors.dim('Goodbye!'));
      inputHandler.close();
      process.exit(0);
    }
    if (input === '/help') {
      printHelp();
      continue;
    }
    if (input === '/clear') {
      runtime.resetSession();
      await runtime.initSession();
      console.clear();
      printWelcomeBanner();
      console.log(colors.dim('  Conversation cleared.\n'));
      continue;
    }
    if (input.startsWith('/agent ')) {
      const task = input.slice('/agent '.length).trim();
      if (!task) {
        console.log(colors.dim('  Usage: /agent <task description>\n'));
        continue;
      }
      await runSubagent(store, toolBundle, task);
      continue;
    }

    try {
      await runtime.processUserTurn(input);
    } catch (error) {
      console.log(
        colors.error(`\nFatal error: ${error instanceof Error ? error.message : String(error)}\n`),
      );
    }
  }
}

/**
 * /agent 命令——生成独立的子代理来处理任务。
 * 子代理拥有独立的会话上下文和消息历史，共享相同的工具集。
 */
async function runSubagent(store: WorkspaceStore, toolBundle: ToolBundle, task: string) {
  console.log(`\n  ${colors.banner(`${symbols.toolStart} Agent`)} ${colors.dim(task)}\n`);

  const { handler, spinner } = createRenderer();

  const agentRuntime = createAgentRuntime({
    workspaceStore: store,
    toolRegistry: toolBundle.registry,
    backgroundManager: toolBundle.backgroundManager,
    scheduleManager: toolBundle.scheduleManager,
    permissionGate: toolBundle.permissionGate,
    hookRunner: toolBundle.hookRunner,
    onUIEvent: handler,
  });

  try {
    await agentRuntime.initSession();
    await agentRuntime.processUserTurn(task);
  } catch (error) {
    spinner.stop();
    console.log(
      colors.error(`  Agent error: ${error instanceof Error ? error.message : String(error)}\n`),
    );
  }
}
