import type { HookEventName, HookResult, HookEvent } from './lifecycle-events.js';

export type HookHandler = (event: HookEvent) => Promise<HookResult>;

export class HookRegistry {
  private readonly hooks = new Map<HookEventName, Array<{ name: string; handler: HookHandler }>>();

  register(event: HookEventName, name: string, handler: HookHandler) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)?.push({ name, handler });
  }

  get(event: HookEventName): Array<{ name: string; handler: HookHandler }> {
    return this.hooks.get(event) || [];
  }
}
