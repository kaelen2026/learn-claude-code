import { describe, expect, it } from 'vitest';
import { MessageState } from './message-state.js';

describe('MessageState', () => {
  it('initializes with user input', () => {
    const state = new MessageState('hello');
    expect(state.getAll()).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('creates empty state via factory', () => {
    const state = MessageState.createEmpty();
    expect(state.getAll()).toEqual([]);
  });

  it('pushes user text', () => {
    const state = MessageState.createEmpty();
    state.pushUserText('hi');
    expect(state.getAll()).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('pushes assistant content', () => {
    const state = new MessageState('hi');
    const content = [{ type: 'text' as const, text: 'hello' }];
    state.pushAssistant(content);
    expect(state.getAll()).toHaveLength(2);
    expect(state.getAll()[1]).toEqual({ role: 'assistant', content });
  });

  it('pushes tool results', () => {
    const state = MessageState.createEmpty();
    const results = [{ type: 'tool_result' as const, tool_use_id: '1', content: 'ok' }];
    state.pushToolResults(results);
    expect(state.getAll()).toHaveLength(1);
    expect(state.getAll()[0].role).toBe('user');
  });

  it('replaces all messages', () => {
    const state = new MessageState('old');
    state.pushUserText('also old');
    state.replaceAll([{ role: 'user', content: 'new' }]);
    expect(state.getAll()).toEqual([{ role: 'user', content: 'new' }]);
  });
});
