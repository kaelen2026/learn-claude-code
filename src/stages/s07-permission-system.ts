/**
 * Stage 07: Permission System（权限系统）
 *
 * 四步决策管道：tool_call → deny rules → mode check → allow rules → ask user
 *
 * 回答三个问题：
 * 1. "这次调用要不要直接拒绝？"
 * 2. "能不能自动放行？"
 * 3. "剩下的要不要问用户？"
 *
 * 三种模式：
 * - default: 未命中规则时问用户（日常交互）
 * - plan: 仅允许读，禁止写（计划审查）
 * - auto: 安全操作自动过（高流畅探索）
 *
 * 学习要点：
 * - 权限规则匹配（支持通配符）
 * - Bash 安全验证（危险模式检测）
 * - 连续拒绝追踪
 * - 中间件设计
 */

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type PermissionBehavior = 'allow' | 'deny' | 'ask';

interface PermissionRule {
  tool: string;           // 工具名，支持通配符 "*"
  behavior: PermissionBehavior;
  path?: string;          // 可选：路径匹配
  content?: string;       // 可选：内容匹配
}

interface PermissionDecision {
  behavior: PermissionBehavior;
  reason: string;
}

type PermissionMode = 'default' | 'plan' | 'auto';

// ============ Bash 安全验证 ============

interface SecurityFlag {
  pattern: string;
  severity: 'critical' | 'warning';
  description: string;
}

class BashSecurityValidator {
  private static readonly DANGEROUS_PATTERNS: SecurityFlag[] = [
    { pattern: 'sudo',            severity: 'critical', description: '权限提升' },
    { pattern: 'rm -rf',          severity: 'critical', description: '递归删除' },
    { pattern: 'rm -r',           severity: 'critical', description: '递归删除' },
    { pattern: '> /dev/',         severity: 'critical', description: '设备写入' },
    { pattern: 'mkfs',            severity: 'critical', description: '格式化文件系统' },
    { pattern: 'dd if=',          severity: 'critical', description: '磁盘直接写入' },
    { pattern: ':(){ :|:& };:',   severity: 'critical', description: 'Fork bomb' },
  ];

  private static readonly SHELL_METACHAR_PATTERNS: SecurityFlag[] = [
    { pattern: ';',    severity: 'warning', description: '命令链接' },
    { pattern: '&&',   severity: 'warning', description: '条件执行' },
    { pattern: '||',   severity: 'warning', description: '条件执行' },
    { pattern: '|',    severity: 'warning', description: '管道' },
    { pattern: '$(',   severity: 'warning', description: '命令替换' },
    { pattern: '`',    severity: 'warning', description: '命令替换（反引号）' },
  ];

  /**
   * 验证 bash 命令的安全性
   */
  static validate(command: string): { safe: boolean; flags: SecurityFlag[] } {
    const flags: SecurityFlag[] = [];

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (command.includes(pattern.pattern)) {
        flags.push(pattern);
      }
    }

    for (const pattern of this.SHELL_METACHAR_PATTERNS) {
      if (command.includes(pattern.pattern)) {
        flags.push(pattern);
      }
    }

    const hasCritical = flags.some((f) => f.severity === 'critical');
    return { safe: !hasCritical && flags.length === 0, flags };
  }
}

// ============ 权限管理器 ============

class PermissionManager {
  private mode: PermissionMode;
  private rules: PermissionRule[] = [];
  private consecutiveDenials = 0;
  private readonly DENIAL_THRESHOLD = 3;

  constructor(mode: PermissionMode = 'default') {
    this.mode = mode;
  }

  /** 添加权限规则 */
  addRule(rule: PermissionRule) {
    this.rules.push(rule);
  }

  /** 获取当前模式 */
  getMode(): PermissionMode {
    return this.mode;
  }

  /** 切换模式 */
  setMode(mode: PermissionMode) {
    this.mode = mode;
    console.log(`🔒 权限模式已切换为: ${mode}\n`);
  }

  /**
   * 四步决策管道：deny rules → mode check → allow rules → ask user
   */
  check(toolName: string, params: Record<string, unknown>): PermissionDecision {
    // 第 1 步：检查拒绝规则
    for (const rule of this.rules) {
      if (rule.behavior === 'deny' && this.matches(rule, toolName, params)) {
        return { behavior: 'deny', reason: `命中拒绝规则: tool=${rule.tool}` };
      }
    }

    // Bash 命令特殊安全检查
    if (toolName === 'run_command') {
      const command = params.command as string;
      const { safe, flags } = BashSecurityValidator.validate(command);
      const criticalFlags = flags.filter((f) => f.severity === 'critical');
      if (criticalFlags.length > 0) {
        return {
          behavior: 'deny',
          reason: `危险命令被拦截: ${criticalFlags.map((f) => f.description).join(', ')}`,
        };
      }
      if (!safe) {
        return {
          behavior: 'ask',
          reason: `检测到风险模式: ${flags.map((f) => f.description).join(', ')}`,
        };
      }
    }

    // 第 2 步：模式检查
    if (this.mode === 'plan') {
      const readOnlyTools = ['read_file', 'search_code', 'list_files'];
      if (!readOnlyTools.includes(toolName)) {
        return { behavior: 'deny', reason: `plan 模式下禁止写操作: ${toolName}` };
      }
      return { behavior: 'allow', reason: 'plan 模式：读操作自动放行' };
    }

    if (this.mode === 'auto') {
      // auto 模式下先检查拒绝规则（已在上面检查），其余自动放行
      return { behavior: 'allow', reason: 'auto 模式：自动放行' };
    }

    // 第 3 步：检查允许规则
    for (const rule of this.rules) {
      if (rule.behavior === 'allow' && this.matches(rule, toolName, params)) {
        return { behavior: 'allow', reason: `命中允许规则: tool=${rule.tool}` };
      }
    }

    // 第 4 步：默认询问用户
    return { behavior: 'ask', reason: `默认行为：需要用户确认 (${toolName})` };
  }

  /**
   * 模拟用户确认交互（演示用，自动批准）
   */
  async askUser(toolName: string, params: Record<string, unknown>): Promise<{
    approved: boolean;
    alwaysAllow: boolean;
  }> {
    console.log(`  ❓ 权限请求: 是否允许执行 ${toolName}?`);
    console.log(`     参数: ${JSON.stringify(params)}`);

    // 演示模式：自动批准，模拟用户选择 "always allow"
    console.log(`  ✅ [模拟用户] 批准并永久允许\n`);
    return { approved: true, alwaysAllow: true };
  }

  /** 记录拒绝 */
  recordDenial() {
    this.consecutiveDenials++;
    if (this.consecutiveDenials >= this.DENIAL_THRESHOLD) {
      console.log(`  ⚠️  连续 ${this.consecutiveDenials} 次被拒绝，建议切换到 plan 模式\n`);
    }
  }

  /** 重置拒绝计数 */
  resetDenials() {
    this.consecutiveDenials = 0;
  }

  /** 获取连续拒绝次数 */
  getConsecutiveDenials(): number {
    return this.consecutiveDenials;
  }

  // ---- 内部方法 ----

  private matches(rule: PermissionRule, toolName: string, params: Record<string, unknown>): boolean {
    // 工具名匹配（支持通配符）
    if (rule.tool !== '*' && rule.tool !== toolName) {
      return false;
    }

    // 路径匹配
    if (rule.path) {
      const filePath = (params.path || params.filename || '') as string;
      if (!this.globMatch(rule.path, filePath)) {
        return false;
      }
    }

    // 内容匹配
    if (rule.content) {
      const content = JSON.stringify(params);
      if (!content.includes(rule.content)) {
        return false;
      }
    }

    return true;
  }

  private globMatch(pattern: string, text: string): boolean {
    // 简单通配符匹配：* 匹配任意字符
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(text);
  }
}

// ============ 带权限的工具执行 ============

async function executeWithPermission(
  tool: Tool,
  params: Record<string, unknown>,
  permManager: PermissionManager
): Promise<string> {
  const decision = permManager.check(tool.name, params);

  console.log(`  🔐 权限决策: ${decision.behavior} — ${decision.reason}`);

  if (decision.behavior === 'deny') {
    permManager.recordDenial();
    return `⛔ 操作被拒绝: ${decision.reason}`;
  }

  if (decision.behavior === 'ask') {
    const { approved, alwaysAllow } = await permManager.askUser(tool.name, params);
    if (!approved) {
      permManager.recordDenial();
      return `⛔ 用户拒绝了操作: ${tool.name}`;
    }
    // 如果用户选择 "always allow"，添加永久允许规则
    if (alwaysAllow) {
      permManager.addRule({ tool: tool.name, behavior: 'allow' });
      console.log(`  📌 已添加永久允许规则: ${tool.name}\n`);
    }
  }

  permManager.resetDenials();
  return await tool.execute(params);
}

// ============ 工具定义 ============

const readFileTool: Tool = {
  name: 'read_file',
  description: '读取文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    return `[模拟] 文件 ${params.path} 的内容:\nconst app = express();\napp.listen(3000);`;
  },
};

const writeFileTool: Tool = {
  name: 'write_file',
  description: '写入文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '写入内容' },
    },
    required: ['path', 'content'],
  },
  execute: async (params) => {
    return `[模拟] 已写入文件: ${params.path} (${(params.content as string).length} 字符)`;
  },
};

const runCommandTool: Tool = {
  name: 'run_command',
  description: '执行 shell 命令',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell 命令' },
    },
    required: ['command'],
  },
  execute: async (params) => {
    return `[模拟] 命令执行结果:\n$ ${params.command}\n(ok)`;
  },
};

// ============ 代理循环 ============

const tools: Tool[] = [readFileTool, writeFileTool, runCommandTool];

const SYSTEM_PROMPT = `你是一个受权限系统保护的 AI 编码助手。

你有以下工具：
- read_file: 读取文件（安全操作）
- write_file: 写入文件（需要权限确认）
- run_command: 执行 shell 命令（会经过安全验证）

为了演示权限系统，请按用户要求执行操作。某些操作可能被拒绝或需要确认。
当操作被拒绝时，解释原因并尝试安全的替代方案。`;

async function agentLoopWithPermissions(userInput: string, mode: PermissionMode = 'default') {
  console.log(`🤖 启动权限保护代理 (模式: ${mode})...\n`);
  console.log(`👤 用户: ${userInput}\n`);

  const permManager = new PermissionManager(mode);

  // 添加默认规则
  permManager.addRule({ tool: 'read_file', behavior: 'allow' }); // 读文件始终允许
  permManager.addRule({ tool: 'write_file', behavior: 'deny', path: '/etc/*' }); // 禁止写系统目录
  permManager.addRule({ tool: 'write_file', behavior: 'deny', path: '*.env' }); // 禁止写 .env 文件

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userInput },
  ];

  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 10;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: anthropicTools,
    });

    console.log(`📊 Stop reason: ${response.stop_reason}\n`);

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 Claude: ${block.text}\n`);
      } else if (block.type === 'tool_use') {
        console.log(`🔧 调用工具: ${block.name}`);
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2));

        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          // 通过权限管理器执行
          const result = await executeWithPermission(
            tool,
            block.input as Record<string, unknown>,
            permManager
          );
          console.log(`📤 结果: ${result}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }

    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
      console.log('✅ 对话结束\n');
    } else if (response.stop_reason === 'tool_use') {
      continueLoop = true;
      console.log('🔄 继续处理...\n');
    }
  }

  // 输出权限统计
  console.log('=== 权限统计 ===');
  console.log(`模式: ${permManager.getMode()}`);
  console.log(`连续拒绝次数: ${permManager.getConsecutiveDenials()}`);
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 07: Permission System 示例 ===\n');

  // 演示 1：Bash 安全验证（独立演示）
  console.log('--- Bash 安全验证演示 ---\n');
  const testCommands = [
    'ls -la',
    'cat /etc/passwd',
    'sudo rm -rf /',
    'echo hello | grep h',
    'npm install express',
  ];
  for (const cmd of testCommands) {
    const { safe, flags } = BashSecurityValidator.validate(cmd);
    const status = safe ? '✅ 安全' : flags.some((f) => f.severity === 'critical') ? '⛔ 危险' : '⚠️  警告';
    const details = flags.length > 0 ? ` [${flags.map((f) => f.description).join(', ')}]` : '';
    console.log(`  ${status} ${cmd}${details}`);
  }
  console.log();

  // 演示 2：带权限的代理循环
  await agentLoopWithPermissions(
    '请帮我完成以下操作：\n1. 读取 src/index.ts 文件\n2. 写入新内容到 src/app.ts\n3. 执行 npm run build 命令\n4. 尝试写入 .env 文件（应该被拒绝）\n5. 尝试执行 sudo rm -rf /（应该被拦截）'
  );
}

export { agentLoopWithPermissions, PermissionManager, BashSecurityValidator };
export type { PermissionRule, PermissionDecision, PermissionMode };
