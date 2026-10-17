import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

describe('loadConfig', () => {
  it('parses Workers-compatible bindings and default values', () => {
    expect(
      loadConfig({
        APP_ENV: 'production',
        CORS_ORIGINS: 'https://app.example,https://admin.example'
      })
    ).toEqual({
      appEnv: 'production',
      port: 8787,
      corsOrigins: ['https://app.example', 'https://admin.example']
    });
  });

  it('rejects an invalid port and non-origin CORS URL', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow();
    expect(() => loadConfig({ CORS_ORIGINS: 'https://example.com/path' })).toThrow();
  });
});
