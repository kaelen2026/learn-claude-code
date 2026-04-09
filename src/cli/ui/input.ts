import { createInterface, type Interface } from 'readline';
import { colors, symbols } from './theme.js';

/**
 * 基于 readline 的交互式输入处理器。
 */
export function createInputHandler(): {
  prompt: () => Promise<string | null>;
  close: () => void;
} {
  const rl: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      rl.question(colors.userPrompt(`${symbols.prompt} `), (answer) => {
        const trimmed = answer.trim();
        resolve(trimmed || null);
      });
    });
  }

  function close(): void {
    rl.close();
  }

  rl.on('close', () => {
    console.log(colors.dim('\nGoodbye!'));
    process.exit(0);
  });

  return { prompt, close };
}
