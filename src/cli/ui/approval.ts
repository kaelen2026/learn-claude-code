import { createInterface } from 'readline';
import type { PermissionApprovalResponse } from '../../sdk/capabilities/permissions/permission-gate.js';
import type { ToolDefinition } from '../../sdk/shared/types.js';
import { formatToolInput } from './format.js';
import { colors, symbols } from './theme.js';

/**
 * 交互式权限审批——当工具需要用户确认时，在终端显示 [y/n/a] 提示。
 * y = approve once, n = deny, a = always allow this tool
 */
export function createApprovalHandler(): (
  tool: ToolDefinition,
  params: Record<string, unknown>,
) => Promise<PermissionApprovalResponse> {
  return async (
    tool: ToolDefinition,
    params: Record<string, unknown>,
  ): Promise<PermissionApprovalResponse> => {
    const inputSummary = formatToolInput(params);
    console.log('');
    console.log(
      `  ${colors.recovery(`${symbols.toolStart} Permission required:`)} ${colors.toolName(tool.name)}`,
    );
    if (inputSummary) {
      console.log(`  ${colors.dim(inputSummary)}`);
    }

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise<PermissionApprovalResponse>((resolve) => {
      rl.question(colors.recovery('  Allow? [y]es / [n]o / [a]lways: '), (answer) => {
        rl.close();
        const choice = answer.trim().toLowerCase();
        if (choice === 'y' || choice === 'yes') {
          resolve({ approved: true, alwaysAllow: false });
        } else if (choice === 'a' || choice === 'always') {
          resolve({ approved: true, alwaysAllow: true });
        } else {
          resolve({ approved: false, alwaysAllow: false });
        }
      });
    });
  };
}
