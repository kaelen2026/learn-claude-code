import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runScheduleCommand } from './schedule.js';

const originalCwd = process.cwd();
const originalExitCode = process.exitCode;

afterEach(() => {
  process.chdir(originalCwd);
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('runScheduleCommand', () => {
  it('rejects invalid cron input from CLI', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'schedule-cli-'));
    process.chdir(workspace);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runScheduleCommand(['create', 'bad-cron', 'remind me']);

    expect(errorSpy).toHaveBeenCalledWith('无效的 cron 表达式: bad-cron');
    expect(process.exitCode).toBe(1);
  });
});
