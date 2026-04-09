/**
 * Anthropic 客户端配置
 * 支持自定义 baseURL 和多种认证方式
 */

import Anthropic from '@anthropic-ai/sdk';
import { appConfig, validateConfig } from './config.js';

/**
 * 创建 Anthropic 客户端
 *
 * 环境变量配置：
 * - ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN: 认证凭证（必需，二选一）
 * - ANTHROPIC_BASE_URL: 自定义 API 端点（可选）
 * - ANTHROPIC_MODEL: 默认模型（可选）
 *
 * 优先级：
 * 1. 函数参数 options.apiKey
 * 2. 环境变量 ANTHROPIC_API_KEY
 * 3. 环境变量 ANTHROPIC_AUTH_TOKEN
 *
 * 使用示例：
 * ```typescript
 * // 使用环境变量
 * const client = createAnthropicClient();
 *
 * // 使用自定义配置
 * const client = createAnthropicClient({
 *   apiKey: 'your-key',
 *   baseURL: 'https://your-proxy.com/v1'
 * });
 * ```
 */
export function createAnthropicClient(options?: { apiKey?: string; baseURL?: string }): Anthropic {
  // 认证凭证优先级：参数 > 配置文件
  const apiKey = options?.apiKey || appConfig.apiKey;
  const baseURL = options?.baseURL || appConfig.baseURL;

  if (!apiKey) {
    validateConfig();
  }

  const config: {
    apiKey: string;
    baseURL?: string;
  } = {
    apiKey: apiKey!,
  };

  // 只有在设置了 baseURL 时才添加
  if (baseURL) {
    config.baseURL = baseURL;
    console.log(`🔧 使用自定义 API 端点: ${baseURL}`);
  }

  return new Anthropic(config);
}

/**
 * 默认客户端实例
 */
export const defaultClient = createAnthropicClient();
