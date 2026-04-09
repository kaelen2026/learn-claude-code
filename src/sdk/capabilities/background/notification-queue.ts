import type { RuntimeNotification } from '../../shared/types.js';

export class NotificationQueue {
  private readonly notifications: RuntimeNotification[] = [];

  push(notification: RuntimeNotification) {
    this.notifications.push(notification);
  }

  drain(): RuntimeNotification[] {
    const drained = [...this.notifications];
    this.notifications.length = 0;
    return drained;
  }
}
