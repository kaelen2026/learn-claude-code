import { describe, expect, it } from 'vitest';
import { commandTouchesSensitiveEnv, isSensitiveEnvPath } from './sensitive-access.js';

describe('isSensitiveEnvPath', () => {
  it('matches dotenv-style files', () => {
    expect(isSensitiveEnvPath('.env')).toBe(true);
    expect(isSensitiveEnvPath('config/.env.local')).toBe(true);
    expect(isSensitiveEnvPath('nested/.env.production')).toBe(true);
  });

  it('does not match unrelated names', () => {
    expect(isSensitiveEnvPath('.envrc')).toBe(false);
    expect(isSensitiveEnvPath('notes/env.txt')).toBe(false);
  });
});

describe('commandTouchesSensitiveEnv', () => {
  it('matches read-style shell commands', () => {
    expect(commandTouchesSensitiveEnv('cat .env')).toBe(true);
    expect(commandTouchesSensitiveEnv('grep API_KEY config/.env.local')).toBe(true);
    expect(commandTouchesSensitiveEnv('sed -n "1,5p" .env.production')).toBe(true);
  });

  it('ignores unrelated commands', () => {
    expect(commandTouchesSensitiveEnv('echo .env')).toBe(false);
    expect(commandTouchesSensitiveEnv('npm run env')).toBe(false);
  });
});
