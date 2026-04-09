/**
 * Stage 19: MCP & Plugin System（MCP 插件系统）
 *
 * MCP 让代理与外部工具服务通信。核心原则：
 * "外部能力不应绕过原生控制平面"
 *
 * 三层模型：
 * 1. Plugin Manifest: 发现与声明（.claude-plugin/plugin.json）
 * 2. MCP Server: 外部进程暴露能力
 * 3. MCP Tool: 单个可调用操作
 *
 * 统一工具池：
 * Native Tools + MCP Tools → 统一工具池 → 权限检查 → 路由执行
 *
 * 命名约定：mcp__{server}__{tool}（避免命名冲突）
 *
 * 学习要点：
 * - 插件发现与加载
 * - MCP 客户端（connect/list_tools/call_tool）
 * - 统一路由（native vs external）
 * - 结果标准化
 * - 权限门控
 */

import { createAnthropicClient } from '../core/client.js';
import type { Tool } from '../core/types.js';

const _client = createAnthropicClient();

// ============ 数据结构 ============

type RiskLevel = 'read' | 'write' | 'high';

interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: RiskLevel;
}

interface MCPServer {
  name: string;
  command: string;
  tools: MCPToolDef[];
  connected: boolean;
}

interface NormalizedResult {
  source: 'native' | 'mcp';
  server: string;
  tool: string;
  risk: RiskLevel;
  status: 'ok' | 'error';
  content: string;
}

interface PermissionGateDecision {
  allowed: boolean;
  reason: string;
}

// ============ CapabilityPermissionGate ============

class CapabilityPermissionGate {
  private deniedPatterns = ['mcp__*__drop_*', 'mcp__*__delete_*'];
  private autoAllowRead = true;

  check(
    source: 'native' | 'mcp',
    server: string,
    tool: string,
    risk: RiskLevel,
  ): PermissionGateDecision {
    const fullName = source === 'mcp' ? `mcp__${server}__${tool}` : tool;

    // 检查拒绝模式
    for (const pattern of this.deniedPatterns) {
      if (this.matchPattern(pattern, fullName)) {
        return { allowed: false, reason: `命中拒绝规则: ${pattern}` };
      }
    }

    // 读操作自动放行
    if (this.autoAllowRead && risk === 'read') {
      return { allowed: true, reason: '读操作自动放行' };
    }

    // 高风险需确认（演示：自动放行）
    if (risk === 'high') {
      return { allowed: true, reason: '高风险操作（已模拟确认）' };
    }

    return { allowed: true, reason: '默认允许' };
  }

  private matchPattern(pattern: string, name: string): boolean {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(name);
  }
}

// ============ MCPClient ============

class MCPClient {
  private server: MCPServer;

  constructor(name: string, command: string) {
    this.server = { name, command, tools: [], connected: false };
  }

  /** 连接（模拟启动外部进程） */
  async connect(): Promise<void> {
    console.log(`  🔌 连接 MCP 服务器: ${this.server.name} (${this.server.command})`);
    this.server.connected = true;
  }

  /** 注册工具 */
  registerTool(tool: MCPToolDef) {
    this.server.tools.push(tool);
  }

  /** 获取工具列表 */
  listTools(): MCPToolDef[] {
    return this.server.tools;
  }

  /** 调用工具（模拟 JSON-RPC） */
  async callTool(toolName: string, params: Record<string, unknown>): Promise<string> {
    const tool = this.server.tools.find((t) => t.name === toolName);
    if (!tool) return `MCP 工具 ${toolName} 不存在`;
    // 模拟执行
    return `[MCP:${this.server.name}] ${toolName}(${JSON.stringify(params)}) → 执行成功`;
  }

  /** 转换为 Agent 工具格式（加前缀） */
  getAgentTools(): Tool[] {
    return this.server.tools.map((t) => ({
      name: `mcp__${this.server.name}__${t.name}`,
      description: `[MCP:${this.server.name}] ${t.description}`,
      input_schema: { type: 'object' as const, properties: t.inputSchema },
      execute: async (params: Record<string, unknown>) => this.callTool(t.name, params),
    }));
  }

  getName(): string {
    return this.server.name;
  }
  isConnected(): boolean {
    return this.server.connected;
  }
}

// ============ MCPToolRouter ============

class MCPToolRouter {
  private nativeTools: Tool[] = [];
  private mcpClients = new Map<string, MCPClient>();
  private gate = new CapabilityPermissionGate();

  addNativeTool(tool: Tool) {
    this.nativeTools.push(tool);
  }
  addMCPClient(mcpClient: MCPClient) {
    this.mcpClients.set(mcpClient.getName(), mcpClient);
  }

  /** 获取统一工具池 */
  getAllTools(): Tool[] {
    const mcpTools = Array.from(this.mcpClients.values()).flatMap((c) => c.getAgentTools());
    return [...this.nativeTools, ...mcpTools];
  }

  /** 路由执行 */
  async execute(toolName: string, params: Record<string, unknown>): Promise<NormalizedResult> {
    // 判断是 native 还是 MCP
    if (toolName.startsWith('mcp__')) {
      const parts = toolName.split('__');
      const serverName = parts[1];
      const originalTool = parts.slice(2).join('__');
      const mcpClient = this.mcpClients.get(serverName);

      if (!mcpClient) {
        return {
          source: 'mcp',
          server: serverName,
          tool: originalTool,
          risk: 'read',
          status: 'error',
          content: `MCP 服务器 ${serverName} 未连接`,
        };
      }

      const toolDef = mcpClient.listTools().find((t) => t.name === originalTool);
      const risk = toolDef?.risk || 'read';

      // 权限检查
      const decision = this.gate.check('mcp', serverName, originalTool, risk);
      if (!decision.allowed) {
        return {
          source: 'mcp',
          server: serverName,
          tool: originalTool,
          risk,
          status: 'error',
          content: `权限拒绝: ${decision.reason}`,
        };
      }

      const result = await mcpClient.callTool(originalTool, params);
      return {
        source: 'mcp',
        server: serverName,
        tool: originalTool,
        risk,
        status: 'ok',
        content: result,
      };
    }

    // Native 工具
    const native = this.nativeTools.find((t) => t.name === toolName);
    if (!native) {
      return {
        source: 'native',
        server: '',
        tool: toolName,
        risk: 'read',
        status: 'error',
        content: `工具 ${toolName} 不存在`,
      };
    }

    const decision = this.gate.check('native', '', toolName, 'read');
    if (!decision.allowed) {
      return {
        source: 'native',
        server: '',
        tool: toolName,
        risk: 'read',
        status: 'error',
        content: `权限拒绝: ${decision.reason}`,
      };
    }

    const result = await native.execute(params);
    return {
      source: 'native',
      server: '',
      tool: toolName,
      risk: 'read',
      status: 'ok',
      content: result,
    };
  }
}

// ============ 演示 ============

async function demo() {
  const router = new MCPToolRouter();

  // 添加原生工具
  router.addNativeTool({
    name: 'read_file',
    description: '读取文件',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: async (params) => `[Native] 读取: ${params.path}`,
  });

  // 创建 MCP 服务器：PostgreSQL
  const pgClient = new MCPClient('postgres', 'npx @mcp/postgres');
  await pgClient.connect();
  pgClient.registerTool({
    name: 'query',
    description: '执行 SQL 查询',
    inputSchema: { sql: { type: 'string' } },
    risk: 'read',
  });
  pgClient.registerTool({
    name: 'insert',
    description: '插入数据',
    inputSchema: { table: { type: 'string' }, data: { type: 'object' } },
    risk: 'write',
  });
  pgClient.registerTool({
    name: 'drop_table',
    description: '删除表',
    inputSchema: { table: { type: 'string' } },
    risk: 'high',
  });
  router.addMCPClient(pgClient);

  // 创建 MCP 服务器：GitHub
  const ghClient = new MCPClient('github', 'npx @mcp/github');
  await ghClient.connect();
  ghClient.registerTool({
    name: 'list_prs',
    description: '列出 PR',
    inputSchema: { repo: { type: 'string' } },
    risk: 'read',
  });
  ghClient.registerTool({
    name: 'create_issue',
    description: '创建 Issue',
    inputSchema: { title: { type: 'string' } },
    risk: 'write',
  });
  router.addMCPClient(ghClient);

  // 展示统一工具池
  console.log('🔧 统一工具池:\n');
  for (const tool of router.getAllTools()) {
    console.log(`  ${tool.name} — ${tool.description}`);
  }
  console.log();

  // 执行工具（测试路由 + 权限）
  console.log('🚀 工具执行演示:\n');

  const calls = [
    { tool: 'read_file', params: { path: 'src/index.ts' } },
    { tool: 'mcp__postgres__query', params: { sql: 'SELECT * FROM users LIMIT 5' } },
    { tool: 'mcp__postgres__insert', params: { table: 'users', data: { name: 'Alice' } } },
    { tool: 'mcp__postgres__drop_table', params: { table: 'users' } },
    { tool: 'mcp__github__list_prs', params: { repo: 'owner/repo' } },
    { tool: 'mcp__github__create_issue', params: { title: 'Bug report' } },
  ];

  for (const { tool, params } of calls) {
    const result = await router.execute(tool, params);
    const icon = result.status === 'ok' ? '✅' : '⛔';
    const src = result.source === 'mcp' ? `MCP:${result.server}` : 'Native';
    console.log(`  ${icon} [${src}] ${tool} → ${result.content}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 19: MCP & Plugin System 示例 ===\n');
  await demo();
}

export type { MCPServer, MCPToolDef, NormalizedResult };
export { CapabilityPermissionGate, MCPClient, MCPToolRouter };
