import type Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from './anthropic-client.js';
import { loadAppConfig } from '../config/app-config.js';
import type { AgentMessage, ToolDefinition } from '../shared/types.js';

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
}
