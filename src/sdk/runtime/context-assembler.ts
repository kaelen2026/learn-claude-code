import { loadAppConfig } from '../config/app-config.js';
import type { WorkspaceStore } from '../stores/workspace-store.js';
import type { ToolDefinition } from '../shared/types.js';
import { SkillRegistry } from '../capabilities/skills/skill-registry.js';
import { MemoryManager } from '../capabilities/memory/memory-manager.js';
import { buildSystemPrompt } from './system-prompt-builder.js';
import { MemoryStore } from '../stores/memory/memory-store.js';

export async function assembleSystemPrompt(input: {
  workspaceStore: WorkspaceStore;
  tools: ToolDefinition[];
}): Promise<string> {
  const config = loadAppConfig();
  const skills = await new SkillRegistry(input.workspaceStore.paths.skillsDir).discover();
  const memories = await new MemoryManager(
    new MemoryStore(
      input.workspaceStore.paths.memoryDir,
      input.workspaceStore.paths.memoryEntriesDir
    )
  ).listSummaries();

  return buildSystemPrompt({
    tools: input.tools,
    skills,
    memories,
    workspaceRoot: input.workspaceStore.paths.workspaceRoot,
    model: config.model,
  });
}
