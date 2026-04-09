import { createInterface, type Interface } from 'readline';
import { colors, symbols } from './theme.js';

/**
 * 基于 readline 的交互式输入处理器。
 * 暴露 question() 方法给 approval handler 复用，避免多个 readline 抢 stdin。
 */
export function createInputHandler(): {
  prompt: () => Promise<string | null>;
  question: (text: string) => Promise<string>;
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

  function question(text: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(text, (answer) => {
        resolve(answer.trim());
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

  return { prompt, question, close };
}
