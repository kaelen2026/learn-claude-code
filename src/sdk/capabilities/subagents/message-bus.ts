import type { MessageEnvelope } from '../../shared/types.js';
import { InboxStore } from '../../stores/teams/inbox-store.js';

export class MessageBus {
  constructor(private readonly inboxStore: InboxStore) {}

  async send(to: string, envelope: MessageEnvelope): Promise<void> {
    await this.inboxStore.send(to, envelope);
  }

  async readInbox(name: string): Promise<MessageEnvelope[]> {
    return this.inboxStore.readInbox(name);
  }
}
