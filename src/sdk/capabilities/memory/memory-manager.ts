import type { MemoryEntryRecord, MemorySummary, MemoryType } from '../../shared/types.js';
import type { MemoryStore } from '../../stores/memory/memory-store.js';

export class MemoryManager {
  constructor(private readonly store: MemoryStore) {}

  async listSummaries(): Promise<MemorySummary[]> {
    const entries = await this.store.loadAll();
    return entries.map(({ name, description, type }) => ({ name, description, type }));
  }

  async save(entry: Omit<MemoryEntryRecord, 'filename'>): Promise<MemoryEntryRecord> {
    return this.store.save(entry);
  }

  async search(query: string): Promise<MemoryEntryRecord[]> {
    const entries = await this.store.loadAll();
    const lower = query.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(lower) ||
        entry.description.toLowerCase().includes(lower) ||
        entry.body.toLowerCase().includes(lower),
    );
  }

  async listAll(type?: MemoryType): Promise<MemoryEntryRecord[]> {
    return type ? this.store.findByType(type) : this.store.loadAll();
  }

  async delete(filename: string): Promise<boolean> {
    return this.store.delete(filename);
  }
}
