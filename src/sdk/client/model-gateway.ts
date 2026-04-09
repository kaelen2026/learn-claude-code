import type Anthropic from '@anthropic-ai/sdk';
import { loadAppConfig } from '../config/app-config.js';
import type { AgentMessage, ToolDefinition } from '../shared/types.js';
import { createAnthropicClient } from './anthropic-client.js';

export interface ModelResponse {
  stopReason: string | null;
  content: Anthropic.ContentBlock[];
}

export class ModelGateway {
  private client = createAnthropicClient();
  private config = loadAppConfig();

  async respond(input: {
    system: string;
    messages: AgentMessage[];
    tools: ToolDefinition[];
  }): Promise<ModelResponse> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: input.system,
      messages: input.messages,
      tools: input.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })),
    });

    return {
      stopReason: response.stop_reason,
      content: response.content,
    };
  }

  /**
   * 流式版本——文本块以 delta 回调实时输出，最终返回与 respond() 相同的 ModelResponse。
   */
  async respondStreaming(input: {
    system: string;
    messages: AgentMessage[];
    tools: ToolDefinition[];
    onTextDelta?: (delta: string) => void;
  }): Promise<ModelResponse> {
    const stream = this.client.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: input.system,
      messages: input.messages,
      tools: input.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })),
    });

    stream.on('text', (delta) => {
      input.onTextDelta?.(delta);
    });

    const finalMessage = await stream.finalMessage();

    return {
      stopReason: finalMessage.stop_reason,
      content: finalMessage.content,
    };
  }
}
