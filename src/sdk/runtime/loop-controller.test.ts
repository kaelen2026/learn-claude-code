import { describe, expect, it } from 'vitest';
import { LoopController } from './loop-controller.js';

describe('LoopController', () => {
  it('defaults to 10 max loops', () => {
    const ctrl = new LoopController();
    for (let i = 0; i < 10; i++) ctrl.next();
    expect(() => ctrl.next()).toThrow('超过最大循环次数 10');
  });

  it('respects custom maxLoops', () => {
    const ctrl = new LoopController({ maxLoops: 3 });
    expect(ctrl.next()).toBe(1);
    expect(ctrl.next()).toBe(2);
    expect(ctrl.next()).toBe(3);
    expect(() => ctrl.next()).toThrow('超过最大循环次数 3');
  });

  it('returns incrementing count', () => {
    const ctrl = new LoopController({ maxLoops: 5 });
    expect(ctrl.next()).toBe(1);
    expect(ctrl.next()).toBe(2);
    expect(ctrl.next()).toBe(3);
  });
});
