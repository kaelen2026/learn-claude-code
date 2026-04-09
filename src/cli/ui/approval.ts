import type { PermissionApprovalResponse } from '../../sdk/capabilities/permissions/permission-gate.js';
import type { ToolDefinition } from '../../sdk/shared/types.js';
import { formatToolInput } from './format.js';
import type { Spinner } from './spinner.js';
import { colors, symbols } from './theme.js';

/**
 * 交互式权限审批——复用主 readline，避免多个 readline 抢 stdin。
 * 接收 spinner 和 question 函数，确保 spinner 停止后再提示用户。
 */
export function createApprovalHandler(
  spinner: Spinner,
  question: (text: string) => Promise<string>,
): (tool: ToolDefinition, params: Record<string, unknown>) => Promise<PermissionApprovalResponse> {
  return async (
    tool: ToolDefinition,
    params: Record<string, unknown>,
  ): Promise<PermissionApprovalResponse> => {
    spinner.stop();

    const inputSummary = formatToolInput(params);
    console.log('');
    console.log(
      `  ${colors.recovery(`${symbols.toolStart} Permission required:`)} ${colors.toolName(tool.name)}`,
    );
    if (inputSummary) {
      console.log(`  ${colors.dim(inputSummary)}`);
    }

    const answer = await question(colors.recovery('  Allow? [y]es / [n]o / [a]lways: '));
    const choice = answer.toLowerCase();

    if (choice === 'y' || choice === 'yes') {
      return { approved: true, alwaysAllow: false };
    }
    if (choice === 'a' || choice === 'always') {
      return { approved: true, alwaysAllow: true };
    }
    return { approved: false, alwaysAllow: false };
  };
}
