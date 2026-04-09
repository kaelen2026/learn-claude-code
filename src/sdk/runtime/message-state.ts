import type Anthropic from '@anthropic-ai/sdk';
import type { AgentMessage } from '../shared/types.js';

export class MessageState {
  private messages: AgentMessage[];

  constructor(initialUserInput: string) {
    this.messages = [{ role: 'user', content: initialUserInput }];
  }

  getAll(): AgentMessage[] {
    return this.messages;
  }

  pushAssistant(content: Anthropic.ContentBlock[]) {
    this.messages.push({ role: 'assistant', content });
  }

  pushToolResults(results: Anthropic.ToolResultBlockParam[]) {
    this.messages.push({ role: 'user', content: results });
  }

  pushUserText(content: string) {
    this.messages.push({ role: 'user', content });
  }

  replaceAll(messages: AgentMessage[]) {
    this.messages = [...messages];
  }
}
