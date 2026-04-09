import type Anthropic from '@anthropic-ai/sdk';

/**
 * 消息类型
 */
export type Message = Anthropic.MessageParam;

/**
 * 工具定义
 */
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<string>;
}

/**
 * 代理配置
 */
export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 任务定义
 */
export interface Task {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}
