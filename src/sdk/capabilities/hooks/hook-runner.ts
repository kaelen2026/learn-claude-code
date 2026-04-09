import type { HookEvent, HookResult } from './lifecycle-events.js';
import { HookRegistry } from './hook-registry.js';

export class HookRunner {
  constructor(private readonly registry: HookRegistry) {}

  async run(event: HookEvent): Promise<HookResult[]> {
    const handlers = this.registry.get(event.name);
    const results: HookResult[] = [];

    for (const { handler } of handlers) {
      try {
        const result = await handler(event);
        results.push(result);
      } catch {
        results.push({ exitCode: 0, message: '' });
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
        message: injected.map((result) => result.message).filter(Boolean).join('\n'),
      };
    }

    return { exitCode: 0, message: '' };
  }
}
