import type { UIEvent } from '../../sdk/runtime/ui-events.js';
import { formatToolInput, formatToolResult } from './format.js';
import { Spinner } from './spinner.js';
import { colors, symbols } from './theme.js';

/**
 * 创建 UIEventHandler 实现——将 runtime 事件翻译为终端输出。
 */
export function createRenderer(): {
  handler: (event: UIEvent) => void;
  spinner: Spinner;
} {
  const spinner = new Spinner();

  function handler(event: UIEvent): void {
    switch (event.type) {
      case 'thinking_start':
        spinner.start('Thinking...');
        break;

      case 'text_delta':
        spinner.stop();
        process.stdout.write(event.delta);
        break;

      case 'text_done':
        process.stdout.write('\n');
        break;

      case 'tool_start': {
        spinner.stop();
        const inputSummary = formatToolInput(event.toolInput);
        console.log(
          `  ${colors.toolName(`${symbols.toolStart} ${event.toolName}`)}${inputSummary ? ` ${colors.toolInput(inputSummary)}` : ''}`,
        );
        spinner.start(`Running ${event.toolName}...`);
        break;
      }

      case 'tool_done': {
        if (event.isError) {
          spinner.fail(`${event.toolName} failed (${event.durationMs}ms)`);
          console.log(colors.toolError(`  ${formatToolResult(event.result, 4)}`));
        } else {
          spinner.succeed(`${event.toolName} (${event.durationMs}ms)`);
          const preview = formatToolResult(event.result, 4);
          if (preview.trim()) {
            const indented = preview
              .split('\n')
              .map((line) => `  ${line}`)
              .join('\n');
            console.log(colors.dim(indented));
          }
        }
        break;
      }

      case 'turn_complete':
        spinner.stop();
        console.log('');
        break;

      case 'error':
        spinner.stop();
        console.log(colors.error(`Error: ${event.message}`));
        break;

      case 'recovery':
        spinner.update(`Recovering: ${event.reason}`);
        break;
    }
  }

  return { handler, spinner };
}
