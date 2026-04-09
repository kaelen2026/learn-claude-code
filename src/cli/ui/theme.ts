import chalk from 'chalk';

// ── 颜色方案 ──────────────────────────────────────────────
export const colors = {
  userPrompt: chalk.bold.cyan,
  userText: chalk.white,
  assistantText: chalk.white,
  toolName: chalk.bold.yellow,
  toolInput: chalk.dim,
  toolResult: chalk.green,
  toolError: chalk.red,
  error: chalk.bold.red,
  dim: chalk.dim,
  bold: chalk.bold,
  banner: chalk.bold.blue,
  recovery: chalk.yellow,
};

// ── 符号 ──────────────────────────────────────────────────
export const symbols = {
  prompt: '>',
  toolStart: '\u25B6', // ▶
  toolDone: '\u2714', // ✔
  toolFail: '\u2718', // ✘
  thinking: '\u2026', // …
  separator: '\u2500', // ─
};
