import type { BackgroundManager } from '../capabilities/background/background-manager.js';
import type { ScheduleManager } from '../capabilities/scheduling/schedule-manager.js';

export async function drainNotifications(input: {
  backgroundManager?: BackgroundManager;
  scheduleManager?: ScheduleManager;
}): Promise<string[]> {
  if (input.scheduleManager) {
    await input.scheduleManager.check();
  }

  const messages: string[] = [];

  if (input.backgroundManager) {
    const notifications = input.backgroundManager
      .drainNotifications()
      .filter((notification) => notification.type === 'background_completed');
    if (notifications.length > 0) {
      messages.push(
        notifications
          .map(
            (notification) =>
              `[后台通知] 任务 ${notification.taskId} ${notification.status}: ${notification.preview.slice(0, 200)}`,
          )
          .join('\n\n'),
      );
    }
  }

  if (input.scheduleManager) {
    const notifications = input.scheduleManager
      .drainNotifications()
      .filter((notification) => notification.type === 'scheduled_prompt');
    if (notifications.length > 0) {
      messages.push(
        notifications
          .map(
            (notification) => `[定时触发] 调度 ${notification.scheduleId}: ${notification.prompt}`,
          )
          .join('\n'),
      );
    }
  }

  return messages;
}
