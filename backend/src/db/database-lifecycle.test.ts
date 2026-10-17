import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';
import { createContainer } from '../container.js';
import type { DbClient } from './client.js';
import * as schema from './schema/index.js';

describe('request-scoped database lifecycle', () => {
  it('creates a fresh client per request and closes it once after the response', async () => {
    const db = drizzle.mock({ schema });
    const closeFirst = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const closeSecond = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const makeClient = (close: () => Promise<void>): DbClient => ({
      db,
      withTransaction: async () => {
        throw new Error('Transactions are not used in this test');
      },
      close
    });
    const clients = [makeClient(closeFirst), makeClient(closeSecond)];
    const createDatabaseClient = vi.fn(async () => clients.shift() ?? makeClient(closeSecond));
    const config = loadConfig({
      APP_ENV: 'test',
      DB_DRIVER: 'neon',
      DATABASE_URL: 'postgres://user:password@localhost/vote_app_test'
    });
    const app = createApp(
      createContainer(config, {
        databaseClientScope: 'request',
        createDatabaseClient
      })
    );

    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);

    expect(createDatabaseClient).toHaveBeenCalledTimes(2);
    expect(closeFirst).toHaveBeenCalledOnce();
    expect(closeSecond).toHaveBeenCalledOnce();
  });
});
