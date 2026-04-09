export function printAssistantMessage(text: string) {
  console.log(`\n=== Assistant ===\n${text}\n`);
}

export { createRenderer } from './renderer.js';
export { printWelcomeBanner } from './welcome.js';
