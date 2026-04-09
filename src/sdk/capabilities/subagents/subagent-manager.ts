export interface SubagentResult {
  id: number;
  task: string;
  result: string;
  duration: number;
}

export class SubagentManager {
  private nextId = 1;
  private readonly results: SubagentResult[] = [];

  async run(task: string, context = ''): Promise<SubagentResult> {
    const id = this.nextId++;
    const startedAt = Date.now();
    const result = context
      ? `子代理 #${id} 已处理任务 "${task}"，上下文摘要: ${context.slice(0, 120)}`
      : `子代理 #${id} 已处理任务 "${task}"`;
    const record: SubagentResult = {
      id,
      task,
      result,
      duration: Date.now() - startedAt,
    };
    this.results.push(record);
    return record;
  }

  listResults(): SubagentResult[] {
    return [...this.results];
  }
}
