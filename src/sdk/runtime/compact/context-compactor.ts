import type Anthropic from '@anthropic-ai/sdk';
import type { AgentMessage } from '../../shared/types.js';
import { estimateContextSize } from './context-estimator.js';
import { CompactState } from './compact-state.js';

const CONTEXT_LIMIT = 50_000;
const KEEP_RECENT_TOOL_RESULTS = 3;

export interface CompactResult {
  messages: AgentMessage[];
  compacted: boolean;
  summary?: string;
}

export class ContextCompactor {
  constructor(private readonly state: CompactState = new CompactState()) {}

  maybeCompact(messages: AgentMessage[]): CompactResult {
    const microCompacted = this.microCompact(messages);
    const size = estimateContextSize(microCompacted);

    if (size <= CONTEXT_LIMIT) {
      return { messages: microCompacted, compacted: false };
    }

    const summary = this.summarize(microCompacted);
    this.state.hasCompacted = true;
    this.state.lastSummary = summary;

    return {
      compacted: true,
      summary,
      messages: [
        {
          role: 'user',
          content: `[上下文已压缩] 以下是之前对话的运行时摘要，请基于此继续：\n\n${summary}`,
        },
        {
          role: 'assistant',
          content: '好的，我会基于压缩后的摘要继续工作。',
        },
      ],
    };
  }

  getState(): CompactState {
    return this.state;
  }

  private microCompact(messages: AgentMessage[]): AgentMessage[] {
    const toolResultIndices: number[] = [];

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (message.role !== 'user' || !Array.isArray(message.content)) continue;
      const hasToolResult = message.content.some(
        (block) => typeof block === 'object' && 'type' in block && block.type === 'tool_result'
      );
      if (hasToolResult) toolResultIndices.push(index);
    }

    if (toolResultIndices.length <= KEEP_RECENT_TOOL_RESULTS) {
      return messages;
    }

    const toCompact = new Set(toolResultIndices.slice(0, -KEEP_RECENT_TOOL_RESULTS));

    return messages.map((message, index) => {
      if (!toCompact.has(index) || !Array.isArray(message.content)) return message;

      return {
        ...message,
        content: message.content.map((block) => {
          if (typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
            const toolBlock = block as Anthropic.ToolResultBlockParam;
            const original = typeof toolBlock.content === 'string'
              ? toolBlock.content
              : JSON.stringify(toolBlock.content);
            return {
              ...toolBlock,
              content: `[已压缩] 原始输出 ${original.length} 字符`,
            };
          }
          return block;
        }),
      };
    });
  }

  private summarize(messages: AgentMessage[]): string {
    const lastMessages = messages.slice(-8).map((message) => {
      const role = message.role === 'user' ? '用户' : '助手';
      const content = typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content).slice(0, 240);
      return `[${role}] ${content}`;
    });

    const persisted = this.state.persistedOutputs.length > 0
      ? `最近持久化输出: ${this.state.persistedOutputs.join(', ')}`
      : '最近没有持久化输出';

    return [
      '当前任务仍在继续。',
      persisted,
      '最近交互摘要：',
      ...lastMessages,
      '下一步：继续基于摘要和最新消息执行工具或生成回答。',
    ].join('\n');
  }
}
