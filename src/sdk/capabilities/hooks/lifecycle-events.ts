export type HookEventName = 'SessionStart' | 'PreToolUse' | 'PostToolUse';

export interface HookEvent {
  name: HookEventName;
  payload: Record<string, unknown>;
}

export interface HookResult {
  exitCode: 0 | 1 | 2;
  message: string;
}
