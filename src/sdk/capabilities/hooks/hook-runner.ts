import type { HookRegistry } from './hook-registry.js';
import type { HookEvent, HookResult } from './lifecycle-events.js';

export class HookRunner {
  constructor(
    private readonly registry: HookRegistry,
    private readonly timeoutMs = 3000,
  ) {}

  async run(event: HookEvent): Promise<HookResult[]> {
    const handlers = this.registry.get(event.name);
    const results: HookResult[] = [];

    for (const { name, handler } of handlers) {
      try {
        const result = await Promise.race<HookResult>([
          handler(event),
          new Promise<HookResult>((resolve) => {
            setTimeout(() => {
              resolve({
                exitCode: 2,
                message: `[hook:${name}] 执行超时，已跳过。`,
              });
            }, this.timeoutMs);
          }),
        ]);
        results.push(result);
      } catch (error) {
        console.warn(`[hook:${name}] failed`, error);
        results.push({
          exitCode: 2,
          message: `[hook:${name}] 执行失败，已跳过。`,
        });
      }
    }

    return results;
  }

  aggregate(results: HookResult[]): HookResult {
    if (results.length === 0) return { exitCode: 0, message: '' };

    const blocked = results.find((result) => result.exitCode === 1);
    if (blocked) return blocked;

    const injected = results.filter((result) => result.exitCode === 2);
    if (injected.length > 0) {
      return {
        exitCode: 2,
        message: injected
          .map((result) => result.message)
          .filter(Boolean)
          .join('\n'),
      };
    }

    return { exitCode: 0, message: '' };
  }
}
