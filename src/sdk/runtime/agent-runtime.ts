import type Anthropic from '@anthropic-ai/sdk';
import type { AutonomousController } from '../capabilities/autonomy/autonomous-controller.js';
import type { BackgroundManager } from '../capabilities/background/background-manager.js';
import type { HookRunner } from '../capabilities/hooks/hook-runner.js';
import type { PermissionGate } from '../capabilities/permissions/permission-gate.js';
import type { ScheduleManager } from '../capabilities/scheduling/schedule-manager.js';
import { ModelGateway } from '../client/model-gateway.js';
import { injectContinuationReminder, selectRecovery } from '../errors/recover.js';
import { backoff } from '../errors/retry-policy.js';
import type { WorkspaceStore } from '../stores/workspace-store.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import { executeToolCall } from '../tools/tool-router.js';
import { ContextCompactor } from './compact/context-compactor.js';
import { assembleSystemPrompt } from './context-assembler.js';
import { LoopController } from './loop-controller.js';
import { MessageState } from './message-state.js';
import { drainNotifications } from './notification-drain.js';
import type { RuntimeRecoveryStats, RuntimeResult } from './runtime-types.js';
import type { UIEventHandler } from './ui-events.js';

export interface AgentRuntimeOptions {
  workspaceStore: WorkspaceStore;
  toolRegistry: ToolRegistry;
  backgroundManager?: BackgroundManager;
  scheduleManager?: ScheduleManager;
  permissionGate?: PermissionGate;
  hookRunner?: HookRunner;
  autonomousController?: AutonomousController;
  onUIEvent?: UIEventHandler;
}

export class AgentRuntime {
  private readonly modelGateway = new ModelGateway();

  // ── 交互式会话状态 ──
  private sessionMessageState: MessageState | null = null;
  private sessionCompactor: ContextCompactor | null = null;
  private sessionSystemPrompt: string | null = null;

  constructor(private readonly options: AgentRuntimeOptions) {}

  // ── 原有的单次调用方法（不变） ──

  async run(userInput: string): Promise<RuntimeResult> {
    const messageState = new MessageState(userInput);
    const loopController = new LoopController({ maxLoops: 10 });
    const tools = this.options.toolRegistry.list();
    const compactor = new ContextCompactor();
    const recoveryState: RuntimeRecoveryStats = {
      continuationAttempts: 0,
      compactAttempts: 0,
      transportAttempts: 0,
    };
    const systemPrompt = await assembleSystemPrompt({
      workspaceStore: this.options.workspaceStore,
      tools,
    });

    if (this.options.hookRunner) {
      const startResults = await this.options.hookRunner.run({
        name: 'SessionStart',
        payload: {
          workspace_root: this.options.workspaceStore.paths.workspaceRoot,
        },
      });
      const startAgg = this.options.hookRunner.aggregate(startResults);
      if (startAgg.message) {
        messageState.pushUserText(startAgg.message);
      }
    }

    let finalText = '';
    let continueLoop = true;

    while (continueLoop) {
      loopController.next();
      const notifications = await drainNotifications({
        backgroundManager: this.options.backgroundManager,
        scheduleManager: this.options.scheduleManager,
      });
      for (const notification of notifications) {
        messageState.pushUserText(notification);
      }
      if (this.options.autonomousController) {
        const reminder = await this.options.autonomousController.buildRuntimeReminder();
        if (reminder) {
          messageState.pushUserText(reminder);
        }
      }

      const compactResult = compactor.maybeCompact(messageState.getAll());
      if (compactResult.compacted) {
        messageState.replaceAll(compactResult.messages);
      }

      let response: Awaited<ReturnType<ModelGateway['respond']>>;
      try {
        response = await this.modelGateway.respond({
          system: systemPrompt,
          messages: messageState.getAll(),
          tools,
        });
      } catch (error) {
        const decision = selectRecovery(
          { errorMessage: error instanceof Error ? error.message : String(error) },
          recoveryState,
        );
        if (decision.kind === 'backoff') {
          await backoff(recoveryState.transportAttempts);
          recoveryState.transportAttempts += 1;
          continue;
        }
        if (decision.kind === 'compact') {
          const forced = compactor.forceCompact(messageState.getAll());
          messageState.replaceAll(forced.messages);
          recoveryState.compactAttempts += 1;
          continue;
        }
        throw error;
      }

      recoveryState.transportAttempts = 0;

      if (response.stopReason === 'max_tokens') {
        const decision = selectRecovery({ stopReason: response.stopReason }, recoveryState);
        if (decision.kind === 'continue') {
          messageState.pushAssistant(response.content);
          messageState.pushUserText(injectContinuationReminder());
          recoveryState.continuationAttempts += 1;
          for (const block of response.content) {
            if (block.type === 'text') {
              finalText += `${block.text}\n`;
            }
          }
          continue;
        }
      }

      messageState.pushAssistant(response.content);
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalText += `${block.text}\n`;
        } else if (block.type === 'tool_use') {
          const outcome = await executeToolCall(tools, block, {
            permissionGate: this.options.permissionGate,
            hookRunner: this.options.hookRunner,
          });
          for (const injectedMessage of outcome.injectedMessages) {
            messageState.pushUserText(injectedMessage);
          }
          toolResults.push(outcome.toolResult);
        }
      }

      if (toolResults.length > 0) {
        messageState.pushToolResults(toolResults);
      }

      continueLoop = response.stopReason === 'tool_use';
    }

    return {
      outputText: finalText.trim(),
    };
  }

  // ── 交互式会话方法 ──

  /** 初始化交互式会话（只调一次） */
  async initSession(): Promise<void> {
    const tools = this.options.toolRegistry.list();
    this.sessionSystemPrompt = await assembleSystemPrompt({
      workspaceStore: this.options.workspaceStore,
      tools,
    });
    this.sessionMessageState = MessageState.createEmpty();
    this.sessionCompactor = new ContextCompactor();

    if (this.options.hookRunner) {
      const startResults = await this.options.hookRunner.run({
        name: 'SessionStart',
        payload: {
          workspace_root: this.options.workspaceStore.paths.workspaceRoot,
        },
      });
      const startAgg = this.options.hookRunner.aggregate(startResults);
      if (startAgg.message) {
        this.sessionMessageState.pushUserText(startAgg.message);
      }
    }
  }

  /** 处理单轮用户输入（含流式输出和工具调用） */
  async processUserTurn(userInput: string, options?: { signal?: AbortSignal }): Promise<void> {
    if (!this.sessionMessageState || !this.sessionCompactor || !this.sessionSystemPrompt) {
      throw new Error('Session not initialized. Call initSession() first.');
    }

    const emit = this.options.onUIEvent ?? (() => {});
    const messageState = this.sessionMessageState;
    const compactor = this.sessionCompactor;
    const systemPrompt = this.sessionSystemPrompt;
    const tools = this.options.toolRegistry.list();
    const loopController = new LoopController({ maxLoops: 30 });
    const recoveryState: RuntimeRecoveryStats = {
      continuationAttempts: 0,
      compactAttempts: 0,
      transportAttempts: 0,
    };

    messageState.pushUserText(userInput);
    let continueLoop = true;

    while (continueLoop) {
      if (options?.signal?.aborted) break;
      loopController.next();

      // drain notifications
      const notifications = await drainNotifications({
        backgroundManager: this.options.backgroundManager,
        scheduleManager: this.options.scheduleManager,
      });
      for (const notification of notifications) {
        messageState.pushUserText(notification);
      }
      if (this.options.autonomousController) {
        const reminder = await this.options.autonomousController.buildRuntimeReminder();
        if (reminder) {
          messageState.pushUserText(reminder);
        }
      }

      // compact
      const compactResult = compactor.maybeCompact(messageState.getAll());
      if (compactResult.compacted) {
        messageState.replaceAll(compactResult.messages);
      }

      // call API (streaming)
      emit({ type: 'thinking_start' });

      let response: Awaited<ReturnType<ModelGateway['respond']>>;
      try {
        response = await this.modelGateway.respondStreaming({
          system: systemPrompt,
          messages: messageState.getAll(),
          tools,
          onTextDelta: (delta) => emit({ type: 'text_delta', delta }),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const decision = selectRecovery({ errorMessage: errorMsg }, recoveryState);

        if (decision.kind === 'backoff') {
          emit({ type: 'recovery', kind: 'backoff', reason: errorMsg });
          await backoff(recoveryState.transportAttempts);
          recoveryState.transportAttempts += 1;
          continue;
        }
        if (decision.kind === 'compact') {
          emit({ type: 'recovery', kind: 'compact', reason: 'context too large' });
          const forced = compactor.forceCompact(messageState.getAll());
          messageState.replaceAll(forced.messages);
          recoveryState.compactAttempts += 1;
          continue;
        }

        emit({ type: 'error', message: errorMsg });
        throw error;
      }

      recoveryState.transportAttempts = 0;

      // handle max_tokens continuation
      if (response.stopReason === 'max_tokens') {
        const decision = selectRecovery({ stopReason: response.stopReason }, recoveryState);
        if (decision.kind === 'continue') {
          messageState.pushAssistant(response.content);
          messageState.pushUserText(injectContinuationReminder());
          recoveryState.continuationAttempts += 1;
          // emit text_done for any text blocks
          for (const block of response.content) {
            if (block.type === 'text') {
              emit({ type: 'text_done', fullText: block.text });
            }
          }
          continue;
        }
      }

      // emit text_done for completed text blocks
      for (const block of response.content) {
        if (block.type === 'text') {
          emit({ type: 'text_done', fullText: block.text });
        }
      }

      messageState.pushAssistant(response.content);
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      // execute tools with events
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          emit({
            type: 'tool_start',
            toolName: block.name,
            toolInput: block.input as Record<string, unknown>,
          });

          const startedAt = Date.now();
          const outcome = await executeToolCall(tools, block, {
            permissionGate: this.options.permissionGate,
            hookRunner: this.options.hookRunner,
          });
          const durationMs = Date.now() - startedAt;

          const resultText =
            typeof outcome.toolResult.content === 'string'
              ? outcome.toolResult.content
              : JSON.stringify(outcome.toolResult.content);

          emit({
            type: 'tool_done',
            toolName: block.name,
            result: resultText,
            durationMs,
            isError: outcome.toolResult.is_error ?? false,
          });

          for (const injectedMessage of outcome.injectedMessages) {
            messageState.pushUserText(injectedMessage);
          }
          toolResults.push(outcome.toolResult);
        }
      }

      if (toolResults.length > 0) {
        messageState.pushToolResults(toolResults);
      }

      continueLoop = response.stopReason === 'tool_use';
    }

    emit({ type: 'turn_complete' });
  }

  /** 重置会话状态（/clear 命令用） */
  resetSession(): void {
    this.sessionMessageState = null;
    this.sessionCompactor = null;
    this.sessionSystemPrompt = null;
  }
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  return new AgentRuntime(options);
}
