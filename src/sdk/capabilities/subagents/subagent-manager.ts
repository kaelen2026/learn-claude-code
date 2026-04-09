/**
 * SubagentRunner: 接收 prompt + systemPrompt，返回 AI 响应文本。
 * 生产环境注入 ModelGateway 包装，测试注入 mock。
 */
export type SubagentRunner = (prompt: string, systemPrompt: string) => Promise<string>;

export interface SubagentResult {
  id: number;
  task: string;
  result: string;
  duration: number;
}

const DEFAULT_SYSTEM_PROMPT = '你是一个专注的研究助手。请直接、简洁地回答问题，控制在 200 字以内。';

export class SubagentManager {
  private nextId = 1;
  private readonly results: SubagentResult[] = [];

  constructor(private readonly runner: SubagentRunner) {}

  async run(task: string, context = ''): Promise<SubagentResult> {
    const id = this.nextId++;
    const prompt = context ? `任务: ${task}\n上下文: ${context}` : task;
    const startedAt = Date.now();
    const result = await this.runner(prompt, DEFAULT_SYSTEM_PROMPT);
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
