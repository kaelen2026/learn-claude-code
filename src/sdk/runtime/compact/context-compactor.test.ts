import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '../../shared/types.js';
import { ContextCompactor } from './context-compactor.js';

function makeMessages(count: number, charsPer = 100): AgentMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: 'x'.repeat(charsPer),
  }));
}

function makeToolResultMessage(id: string, content: string): AgentMessage {
  return {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: id, content }],
  };
}

describe('ContextCompactor', () => {
  describe('maybeCompact', () => {
    it('does not compact short conversations', () => {
      const compactor = new ContextCompactor();
      const messages = makeMessages(5, 100);
      const result = compactor.maybeCompact(messages);

      expect(result.compacted).toBe(false);
      expect(result.messages.length).toBe(5);
    });

    it('compacts when context exceeds limit', () => {
      const compactor = new ContextCompactor();
      const messages = makeMessages(100, 1000);
      const result = compactor.maybeCompact(messages);

      expect(result.compacted).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.messages.length).toBe(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
    });

    it('updates compact state after compaction', () => {
      const compactor = new ContextCompactor();
      const messages = makeMessages(100, 1000);
      compactor.maybeCompact(messages);

      expect(compactor.getState().hasCompacted).toBe(true);
      expect(compactor.getState().lastSummary.length).toBeGreaterThan(0);
    });
  });

  describe('forceCompact', () => {
    it('always compacts regardless of size', () => {
      const compactor = new ContextCompactor();
      const messages = makeMessages(2, 10);
      const result = compactor.forceCompact(messages);

      expect(result.compacted).toBe(true);
      expect(result.messages.length).toBe(2);
    });
  });

  describe('microCompact', () => {
    it('preserves recent tool results and compacts old ones', () => {
      const compactor = new ContextCompactor();
      const messages: AgentMessage[] = [
        { role: 'user', content: 'start' },
        makeToolResultMessage('1', 'a'.repeat(500)),
        makeToolResultMessage('2', 'b'.repeat(500)),
        makeToolResultMessage('3', 'c'.repeat(500)),
        makeToolResultMessage('4', 'd'.repeat(500)),
        makeToolResultMessage('5', 'e'.repeat(500)),
      ];

      const result = compactor.maybeCompact(messages);

      // 3 most recent tool results should be preserved
      // 2 oldest should be compacted
      const toolMsgs = result.messages.filter(
        (m) => Array.isArray(m.content) && m.content.some((b: any) => b.type === 'tool_result'),
      );

      const compactedCount = toolMsgs.filter(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some(
            (b: any) => typeof b.content === 'string' && b.content.startsWith('[已压缩]'),
          ),
      ).length;

      expect(compactedCount).toBe(2);
    });
  });
});
