import { NotificationQueue } from '../../sdk/capabilities/background/notification-queue.js';
import { isValidCron } from '../../sdk/capabilities/scheduling/cron-parser.js';
import {
  formatSchedule,
  ScheduleManager,
} from '../../sdk/capabilities/scheduling/schedule-manager.js';
import { ScheduleStore } from '../../sdk/stores/schedules/schedule-store.js';
import { createWorkspaceStore } from '../../sdk/stores/workspace-store.js';

export async function runScheduleCommand(argv: string[]) {
  const [subcommand = 'list', ...rest] = argv;
  const workspaceStore = createWorkspaceStore(process.cwd());
  await workspaceStore.init();

  const manager = new ScheduleManager(
    new ScheduleStore(workspaceStore.paths.schedulesDir),
    new NotificationQueue(),
  );
  await manager.init();

  switch (subcommand) {
    case 'list': {
      const schedules = await manager.list();
      if (schedules.length === 0) {
        console.log('当前没有定时调度任务');
        return;
      }
      for (const schedule of schedules) {
        console.log(`${formatSchedule(schedule)}\n`);
      }
      return;
    }
    case 'create': {
      const [cron, ...promptParts] = rest;
      const prompt = promptParts.join(' ').trim();
      if (!cron || !prompt) {
        console.error(
          '请提供 cron 和 prompt，例如: npm start -- schedule create "*/5 * * * *" "提醒我检查测试结果"',
        );
        process.exitCode = 1;
        return;
      }
      if (!isValidCron(cron)) {
        console.error(`无效的 cron 表达式: ${cron}`);
        process.exitCode = 1;
        return;
      }
      const record = await manager.create(cron, prompt, true);
      console.log(`已创建调度:\n${formatSchedule(record)}`);
      return;
    }
    case 'check': {
      const fired = await manager.check();
      console.log(`本轮检查触发 ${fired.length} 条通知`);
      for (const notification of fired) {
        if (notification.type === 'scheduled_prompt') {
          console.log(`- ${notification.scheduleId}: ${notification.prompt}`);
        }
      }
      return;
    }
    default:
      console.error(`未知 schedule 子命令: ${subcommand}`);
      process.exitCode = 1;
  }
}
