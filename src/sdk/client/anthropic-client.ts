import Anthropic from '@anthropic-ai/sdk';
import { loadAppConfig } from '../config/app-config.js';

export function createAnthropicClient() {
  const config = loadAppConfig();
  if (!config.apiKey) {
    throw new Error('认证凭证未设置。请在 .env 中配置 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN');
  }

  return new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}
