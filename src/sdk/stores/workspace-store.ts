import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveWorkspacePaths, type WorkspacePaths } from '../config/paths.js';

export interface WorkspaceStore {
  paths: WorkspacePaths;
  init: () => Promise<void>;
}

export function createWorkspaceStore(workspaceRoot: string): WorkspaceStore {
  const paths = resolveWorkspacePaths(workspaceRoot);

  return {
    paths,
    init: async () => {
      const dirs = [
        paths.dataRoot,
        paths.sessionsDir,
        paths.memoryDir,
        paths.memoryEntriesDir,
        paths.tasksDir,
        paths.backgroundDir,
        paths.backgroundTasksDir,
        paths.backgroundOutputDir,
        paths.schedulesDir,
        paths.teamsDir,
        paths.teamsInboxDir,
        paths.worktreesDir,
        paths.eventsDir,
      ];

      for (const dir of dirs) {
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }
      }

      const memoryIndex = join(paths.memoryDir, 'MEMORY.md');
      if (!existsSync(memoryIndex)) {
        await writeFile(memoryIndex, '# Memory Index\n', 'utf-8');
      }
    },
  };
}
