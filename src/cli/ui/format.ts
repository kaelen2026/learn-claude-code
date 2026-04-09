import { colors } from './theme.js';

/** 工具参数格式化为一行摘要 */
export function formatToolInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return '';

  const parts = entries.slice(0, 2).map(([key, value]) => {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    const truncated = str.length > 60 ? `${str.slice(0, 57)}...` : str;
    return `${key}=${truncated}`;
  });
  if (entries.length > 2) parts.push('...');
  return parts.join(', ');
}

/** 截断长工具结果 */
export function formatToolResult(result: string, maxLines: number = 6): string {
  const lines = result.split('\n');
  if (lines.length <= maxLines) return result;
  return (
    lines.slice(0, maxLines).join('\n') +
    `\n${colors.dim(`... (${lines.length - maxLines} more lines)`)}`
  );
}
