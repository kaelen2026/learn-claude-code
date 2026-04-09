import './env.js';

export interface AppConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export function loadAppConfig(): AppConfig {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: Number.parseInt(process.env.MAX_TOKENS || '2048', 10),
    temperature: Number.parseFloat(process.env.TEMPERATURE || '1.0'),
  };
}
