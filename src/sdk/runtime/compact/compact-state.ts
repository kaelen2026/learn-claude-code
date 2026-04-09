export class CompactState {
  hasCompacted = false;
  lastSummary = '';
  persistedOutputs: string[] = [];

  trackPersistedOutput(path: string) {
    this.persistedOutputs = [path, ...this.persistedOutputs.filter((item) => item !== path)].slice(0, 5);
  }
}
