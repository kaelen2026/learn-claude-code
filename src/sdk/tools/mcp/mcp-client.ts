import type { MCPServerRecord, MCPToolDef, ToolDefinition } from '../../shared/types.js';

export class MCPClient {
  private readonly server: MCPServerRecord;

  constructor(name: string, command: string) {
    this.server = {
      name,
      command,
      tools: [],
      connected: false,
    };
  }

  async connect(): Promise<void> {
    this.server.connected = true;
  }

  registerTool(tool: MCPToolDef): void {
    this.server.tools.push(tool);
  }

  listTools(): MCPToolDef[] {
    return [...this.server.tools];
  }

  async callTool(toolName: string, params: Record<string, unknown>): Promise<string> {
    const tool = this.server.tools.find((item) => item.name === toolName);
    if (!tool) return `MCP 工具 ${toolName} 不存在`;
    return `[MCP:${this.server.name}] ${toolName}(${JSON.stringify(params)}) → 执行成功`;
  }

  getAgentTools(): ToolDefinition[] {
    return this.server.tools.map((tool) => ({
      name: `mcp__${this.server.name}__${tool.name}`,
      description: `[MCP:${this.server.name}] ${tool.description}`,
      riskLevel: tool.risk,
      inputSchema: {
        type: 'object',
        properties: tool.inputSchema,
      },
      execute: async (params) => this.callTool(tool.name, params),
    }));
  }

  getName(): string {
    return this.server.name;
  }
}
