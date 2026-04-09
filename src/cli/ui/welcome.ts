import { colors, symbols } from './theme.js';

export function printWelcomeBanner(): void {
  const line = symbols.separator.repeat(50);
  console.log('');
  console.log(colors.banner('  Learn Claude Code \u2014 Interactive Chat'));
  console.log(colors.dim(`  ${line}`));
  console.log(colors.dim('  Type your message and press Enter to chat.'));
  console.log(colors.dim('  Commands: /help, /agent, /clear, /exit'));
  console.log(colors.dim('  Press ESC to abort, Ctrl+C to exit.'));
  console.log('');
}

export function printHelp(): void {
  console.log('');
  console.log(colors.bold('  Available commands:'));
  console.log(colors.dim('  /help            \u2014 Show this help'));
  console.log(colors.dim('  /agent <task>    \u2014 Spawn an independent agent for a task'));
  console.log(colors.dim('  /clear           \u2014 Clear conversation history'));
  console.log(colors.dim('  /exit            \u2014 Exit the chat'));
  console.log('');
  console.log(colors.bold('  Shortcuts:'));
  console.log(colors.dim('  ESC              \u2014 Abort current task'));
  console.log(colors.dim('  Ctrl+C           \u2014 Exit'));
  console.log('');
}
