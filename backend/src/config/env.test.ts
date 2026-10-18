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
      dbDriver: 'pg',
      port: 8787,
      appBaseUrl: 'http://localhost:3000',
      cookieDomain: '',
      passwordHashIterations: 5_000,
      enableEmailVerification: false,
      emailProvider: 'console',
      emailFrom: 'noreply@example.test',
      cloudinaryUploadFolder: 'voting-app',
      publicPollBallotCeiling: 2_500,
      retentionDays: 7,
      corsOrigins: ['https://app.example', 'https://admin.example']
    });
  });

  it('parses authentication settings and requires a Brevo API key', () => {
    expect(
      loadConfig({
        PASSWORD_HASH_ITERATIONS: '25000',
        ENABLE_EMAIL_VERIFICATION: 'true',
        COOKIE_DOMAIN: 'example.test'
      })
    ).toMatchObject({
      passwordHashIterations: 25_000,
      enableEmailVerification: true,
      cookieDomain: 'example.test'
    });
    expect(() => loadConfig({ EMAIL_PROVIDER: 'brevo' })).toThrow();
  });

  it('parses database driver settings and rejects invalid settings', () => {
    expect(
      loadConfig({
        DB_DRIVER: 'neon',
        DATABASE_URL: 'postgres://user:password@localhost/vote_app_dev'
      })
    ).toMatchObject({
      dbDriver: 'neon',
      databaseUrl: 'postgres://user:password@localhost/vote_app_dev'
    });

    expect(() => loadConfig({ DB_DRIVER: 'sqlite' })).toThrow();
    expect(() => loadConfig({ DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('loads Cloudinary upload credentials and folder settings', () => {
    expect(
      loadConfig({
        CLOUDINARY_CLOUD_NAME: 'cloud-name',
        CLOUDINARY_API_KEY: 'api-key',
        CLOUDINARY_API_SECRET: 'api-secret',
        CLOUDINARY_UPLOAD_FOLDER: 'custom-folder'
      })
    ).toMatchObject({
      cloudinaryCloudName: 'cloud-name',
      cloudinaryApiKey: 'api-key',
      cloudinaryApiSecret: 'api-secret',
      cloudinaryUploadFolder: 'custom-folder'
    });
  });

  it('rejects an invalid port and non-origin CORS URL', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow();
    expect(() => loadConfig({ CORS_ORIGINS: 'https://example.com/path' })).toThrow();
  });

  it('limits raw-data retention to the supported 7-to-14-day window', () => {
    expect(loadConfig({ RETENTION_DAYS: '14' }).retentionDays).toBe(14);
    expect(() => loadConfig({ RETENTION_DAYS: '6' })).toThrow();
    expect(() => loadConfig({ RETENTION_DAYS: '15' })).toThrow();
  });
});
