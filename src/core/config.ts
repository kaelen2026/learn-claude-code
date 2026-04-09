/**
 * 配置管理
 */

import { config } from 'dotenv';

// 加载 .env 文件
config();

/**
 * 应用配置
 */
export const appConfig = {
  // 认证
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,

  // 模型配置
  model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',

  // 默认参数
  maxTokens: parseInt(process.env.MAX_TOKENS || '2048', 10),
  temperature: parseFloat(process.env.TEMPERATURE || '1.0'),
};

/**
 * 验证配置
 */
export function validateConfig() {
  if (!appConfig.apiKey) {
    throw new Error(
      '认证凭证未设置。请在 .env 文件中配置 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN'
    );
  }
}
