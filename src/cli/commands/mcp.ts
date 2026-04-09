import { MCPRegistry } from '../../sdk/tools/mcp/mcp-registry.js';
import { MCPClient } from '../../sdk/tools/mcp/mcp-client.js';

export async function runMcpCommand(argv: string[]) {
  const [subcommand = 'list'] = argv;
  const registry = new MCPRegistry();

  const postgres = new MCPClient('postgres', 'npx @mcp/postgres');
  await postgres.connect();
  postgres.registerTool({
    name: 'query',
    description: '执行 SQL 查询',
    inputSchema: { sql: { type: 'string' } },
    risk: 'read',
  });
  registry.addClient(postgres);

  const github = new MCPClient('github', 'npx @mcp/github');
  await github.connect();
  github.registerTool({
    name: 'list_prs',
    description: '列出 PR',
    inputSchema: { repo: { type: 'string' } },
    risk: 'read',
  });
  registry.addClient(github);

  if (subcommand === 'list') {
    for (const client of registry.listClients()) {
      console.log(`${client.getName()}:`);
      for (const tool of client.listTools()) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }
    return;
  }

  console.error(`未知 mcp 子命令: ${subcommand}`);
  process.exitCode = 1;
}
