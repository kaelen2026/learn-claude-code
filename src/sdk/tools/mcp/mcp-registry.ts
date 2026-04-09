import type { ToolDefinition } from '../../shared/types.js';
import { MCPClient } from './mcp-client.js';

export class MCPRegistry {
  private readonly clients = new Map<string, MCPClient>();

  addClient(client: MCPClient): void {
    this.clients.set(client.getName(), client);
  }

  listClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  getAllTools(): ToolDefinition[] {
    return this.listClients().flatMap((client) => client.getAgentTools());
  }
}
