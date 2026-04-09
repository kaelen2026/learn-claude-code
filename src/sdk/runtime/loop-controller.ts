export interface LoopControllerOptions {
  maxLoops?: number;
}

export class LoopController {
  private readonly maxLoops: number;
  private loopCount = 0;

  constructor(options: LoopControllerOptions = {}) {
    this.maxLoops = options.maxLoops ?? 10;
  }

  next(): number {
    this.loopCount += 1;
    if (this.loopCount > this.maxLoops) {
      throw new Error(`超过最大循环次数 ${this.maxLoops}`);
    }
    return this.loopCount;
  }
}
