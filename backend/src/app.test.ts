import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { createLogger } from './core/logger.js';

describe('GET /api/v1/health', () => {
  it('returns the runtime environment and an ISO timestamp', async () => {
    const app = createApp(createContainer(loadConfig({ APP_ENV: 'test' })));
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', env: 'test' });
    expect(Number.isNaN(Date.parse(response.body.time))).toBe(false);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns message keys and a request id for unknown routes', async () => {
    const app = createApp(createContainer(loadConfig({ APP_ENV: 'test' })));
    const response = await request(app).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body.error.key).toBe('errors.route.not_found');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('logger redaction', () => {
  it('redacts sensitive fields before writing', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = createLogger();

    logger.info({ event: 'test', phoneNumber: 'private', safe: 'visible' });

    expect(output).toHaveBeenCalledWith(
      JSON.stringify({
        level: 'info',
        event: 'test',
        phoneNumber: '[REDACTED]',
        safe: 'visible'
      })
    );
    output.mockRestore();
  });
});
