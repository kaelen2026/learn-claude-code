import { join } from 'path';

export interface WorkspacePaths {
  workspaceRoot: string;
  dataRoot: string;
  sessionsDir: string;
  memoryDir: string;
  memoryEntriesDir: string;
  tasksDir: string;
  backgroundDir: string;
  backgroundTasksDir: string;
  backgroundOutputDir: string;
  schedulesDir: string;
  teamsDir: string;
  teamsInboxDir: string;
  worktreesDir: string;
  eventsDir: string;
  skillsDir: string;
}

export function resolveWorkspacePaths(workspaceRoot: string): WorkspacePaths {
  const dataRoot = join(workspaceRoot, 'data');
  const memoryDir = join(dataRoot, 'memory');
  const teamsDir = join(dataRoot, 'teams');
  const backgroundDir = join(dataRoot, 'background');

  return {
    workspaceRoot,
    dataRoot,
    sessionsDir: join(dataRoot, 'sessions'),
    memoryDir,
    memoryEntriesDir: join(memoryDir, 'entries'),
    tasksDir: join(dataRoot, 'tasks'),
    backgroundDir,
    backgroundTasksDir: join(backgroundDir, 'tasks'),
    backgroundOutputDir: join(backgroundDir, 'output'),
    schedulesDir: join(dataRoot, 'schedules'),
    teamsDir,
    teamsInboxDir: join(teamsDir, 'inbox'),
    worktreesDir: join(dataRoot, 'worktrees'),
    eventsDir: join(dataRoot, 'events'),
    skillsDir: join(workspaceRoot, 'skills'),
  };
}
