/**
 * UI Events — runtime 和 UI 层之间的桥梁
 *
 * 使用 discriminated union 而非 EventEmitter，保持类型安全且易于理解。
 * runtime 不依赖任何 UI 库——只调用回调函数。
 */

export type UIEvent =
  | { type: 'thinking_start' }
  | { type: 'text_delta'; delta: string }
  | { type: 'text_done'; fullText: string }
  | { type: 'tool_start'; toolName: string; toolInput: Record<string, unknown> }
  | {
      type: 'tool_done';
      toolName: string;
      result: string;
      durationMs: number;
      isError: boolean;
    }
  | { type: 'turn_complete' }
  | { type: 'error'; message: string }
  | { type: 'recovery'; kind: string; reason: string };

export type UIEventHandler = (event: UIEvent) => void;
