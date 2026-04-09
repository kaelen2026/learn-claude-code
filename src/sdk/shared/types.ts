import type Anthropic from '@anthropic-ai/sdk';

export type AgentMessage = Anthropic.MessageParam;

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel?: 'read' | 'write' | 'high';
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (input: Record<string, unknown>) => Promise<string>;
}

export interface SkillManifest {
  name: string;
  description: string;
}

export interface MemorySummary {
  name: string;
  description: string;
  type: string;
}

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

export interface MemoryEntryRecord {
  name: string;
  description: string;
  type: MemoryType;
  filename: string;
  body: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

export interface TaskRecord {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
  blockedBy: number[];
  blocks: number[];
  owner: string;
}

export type RuntimeTaskStatus = 'running' | 'completed' | 'failed';

export interface RuntimeTaskRecord {
  id: string;
  command: string;
  status: RuntimeTaskStatus;
  startedAt: number;
  resultPreview: string;
  outputFile: string;
}

export interface ScheduleRecord {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  createdAt: number;
  lastFiredAt: number | null;
}

export type RuntimeNotification =
  | {
      type: 'background_completed';
      taskId: string;
      status: RuntimeTaskStatus;
      preview: string;
    }
  | {
      type: 'scheduled_prompt';
      scheduleId: string;
      prompt: string;
    };

export type MemberStatus = 'idle' | 'working' | 'shutdown';

export interface TeamMemberRecord {
  name: string;
  role: string;
  status: MemberStatus;
}

export interface MessageEnvelope {
  type: 'message';
  from: string;
  content: string;
  timestamp: number;
}

export type WorktreeStatus = 'active' | 'kept' | 'removed';

export interface CloseoutRecord {
  action: 'keep' | 'remove';
  reason: string;
  timestamp: number;
}

export interface WorktreeRecord {
  name: string;
  path: string;
  branch: string;
  taskId: number | null;
  status: WorktreeStatus;
  lastEnteredAt: number | null;
  lastCommandAt: number | null;
  closeout: CloseoutRecord | null;
}

export interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: 'read' | 'write' | 'high';
}

export interface MCPServerRecord {
  name: string;
  command: string;
  tools: MCPToolDef[];
  connected: boolean;
}
