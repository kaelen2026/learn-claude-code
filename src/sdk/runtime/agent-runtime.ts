import type Anthropic from '@anthropic-ai/sdk';
import { ModelGateway } from '../client/model-gateway.js';
import type { WorkspaceStore } from '../stores/workspace-store.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { executeToolCall } from '../tools/tool-router.js';
import { assembleSystemPrompt } from './context-assembler.js';
import { MessageState } from './message-state.js';
import { LoopController } from './loop-controller.js';
import type { RuntimeResult } from './runtime-types.js';
import type { RuntimeRecoveryStats } from './runtime-types.js';
import { drainNotifications } from './notification-drain.js';
import type { BackgroundManager } from '../capabilities/background/background-manager.js';
import type { ScheduleManager } from '../capabilities/scheduling/schedule-manager.js';
import type { PermissionGate } from '../capabilities/permissions/permission-gate.js';
import type { HookRunner } from '../capabilities/hooks/hook-runner.js';
import { ContextCompactor } from './compact/context-compactor.js';
import { backoff } from '../errors/retry-policy.js';
import { injectContinuationReminder, selectRecovery } from '../errors/recover.js';
import type { AutonomousController } from '../capabilities/autonomy/autonomous-controller.js';

export interface AgentRuntimeOptions {
  workspaceStore: WorkspaceStore;
  toolRegistry: ToolRegistry;
  backgroundManager?: BackgroundManager;
  scheduleManager?: ScheduleManager;
  permissionGate?: PermissionGate;
  hookRunner?: HookRunner;
  autonomousController?: AutonomousController;
}

export class AgentRuntime {
  private readonly modelGateway = new ModelGateway();

  constructor(private readonly options: AgentRuntimeOptions) {}

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
          recoveryState
        );
        if (decision.kind === 'backoff') {
          await backoff(recoveryState.transportAttempts);
          recoveryState.transportAttempts += 1;
          continue;
        }
        if (decision.kind === 'compact') {
          const forced = compactor.maybeCompact(messageState.getAll());
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
          toolResults.push(
            await executeToolCall(tools, block, {
              permissionGate: this.options.permissionGate,
              hookRunner: this.options.hookRunner,
            })
          );
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
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  return new AgentRuntime(options);
}
