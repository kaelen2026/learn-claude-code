import type { RecoveryDecision, RecoveryState } from './error-types.js';
import { MAX_COMPACT, MAX_CONTINUATION, MAX_TRANSPORT_RETRY } from './error-types.js';

export function selectRecovery(input: {
  stopReason?: string | null;
  errorMessage?: string;
}, state: RecoveryState): RecoveryDecision {
  if (input.stopReason === 'max_tokens') {
    if (state.continuationAttempts >= MAX_CONTINUATION) {
      return { kind: 'fail', reason: `续写次数已达上限 (${MAX_CONTINUATION})` };
    }
    return { kind: 'continue', reason: '输出被截断，注入续写提示' };
  }

  const message = (input.errorMessage || '').toLowerCase();
  if (
    (message.includes('prompt') && message.includes('long')) ||
    message.includes('context_length') ||
    message.includes('too many tokens')
  ) {
    if (state.compactAttempts >= MAX_COMPACT) {
      return { kind: 'fail', reason: `压缩次数已达上限 (${MAX_COMPACT})` };
    }
    return { kind: 'compact', reason: '上下文过长，需要压缩历史' };
  }

  if (
    message.includes('timeout') ||
    message.includes('rate') ||
    message.includes('connection') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('overloaded')
  ) {
    if (state.transportAttempts >= MAX_TRANSPORT_RETRY) {
      return { kind: 'fail', reason: `重试次数已达上限 (${MAX_TRANSPORT_RETRY})` };
    }
    return { kind: 'backoff', reason: '临时错误，指数退避重试' };
  }

  return {
    kind: 'fail',
    reason: `无法恢复的错误: ${input.errorMessage || input.stopReason || '未知'}`,
  };
}

export function injectContinuationReminder(): string {
  return '你的输出被截断了。请继续直接从停止处接着写，不要重复已输出的内容。';
}
