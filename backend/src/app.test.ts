import request from 'supertest';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { createErrorHandler } from './core/error-handler.js';
import { createLogger } from './core/logger.js';
import { createRequestTimeout } from './middleware/request-timeout.js';

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
    expect(response.body.error.stack).toBeUndefined();
  });

  it('rejects unknown origins and permits configured origins with credentials', async () => {
    const app = createApp(
      createContainer(loadConfig({ APP_ENV: 'test', CORS_ORIGINS: 'https://app.example.test' }))
    );

    const denied = await request(app).get('/api/v1/health').set('Origin', 'https://evil.test');
    expect(denied.status).toBe(403);
    expect(denied.body.error.key).toBe('errors.cors.origin_denied');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();

    const allowed = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://app.example.test');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.test');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sets security headers on API responses', async () => {
    const app = createApp(createContainer(loadConfig({ APP_ENV: 'test' })));
    const response = await request(app).get('/api/v1/health').set('x-forwarded-proto', 'https');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('maps oversized and malformed JSON bodies to message-key errors', async () => {
    const app = createApp(createContainer(loadConfig({ APP_ENV: 'test' })));
    const oversized = await request(app)
      .post('/api/v1/host/auth/signup')
      .type('json')
      .send({ payload: 'x'.repeat(1_048_576) });
    const malformed = await request(app)
      .post('/api/v1/host/auth/signup')
      .set('Content-Type', 'application/json')
      .send('{"invalid":');

    expect(oversized.status).toBe(413);
    expect(oversized.body.error.key).toBe('errors.request.body_too_large');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.key).toBe('errors.request.body_invalid');
    expect(JSON.stringify(oversized.body)).not.toContain('payload');
  });
});

describe('logger redaction', () => {
  it('redacts sensitive values from captured log output at every level', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = createLogger();
    const privateValues = [
      'token-private-value',
      '+265991234567',
      'Voter Example',
      'Password-private-value',
      'host_session=private-cookie',
      'host@example.test'
    ];

    logger.info({
      event: 'test',
      token: privateValues[0],
      phoneNumber: privateValues[1],
      fullName: privateValues[2],
      password: privateValues[3],
      cookie: privateValues[4],
      email: privateValues[5],
      safe: 'visible'
    });
    logger.warn({ event: 'warning', nested: [{ voterName: privateValues[2] }] });
    logger.error({ event: 'error', authorization: privateValues[0] });

    const captured = [
      ...output.mock.calls.flatMap(([entry]) => [entry]),
      ...warnings.mock.calls.flatMap(([entry]) => [entry]),
      ...errors.mock.calls.flatMap(([entry]) => [entry])
    ].join('\n');
    for (const value of privateValues) expect(captured).not.toContain(value);
    expect(captured).toContain('[REDACTED]');
    expect(captured).toContain('visible');
    output.mockRestore();
    warnings.mockRestore();
    errors.mockRestore();
  });
});

describe('request timeout middleware', () => {
  it('returns a consistent timeout response when a route exceeds its deadline', async () => {
    const app = express();
    const logger = createLogger();
    app.use(createRequestTimeout(5));
    app.get('/slow', (_request, response) => {
      setTimeout(() => {
        if (!response.headersSent) response.status(200).end();
      }, 30);
    });
    app.use(createErrorHandler(logger));

    const response = await request(app).get('/slow');
    expect(response.status).toBe(408);
    expect(response.body.error.key).toBe('errors.request.timeout');
    expect(response.body.error.stack).toBeUndefined();
  });
});
