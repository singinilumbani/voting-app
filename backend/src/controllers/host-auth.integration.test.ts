import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/env.js';
import { createContainer } from '../container.js';
import { createTestDatabase } from '../db/test-helpers.js';
import type { DbClient } from '../db/client.js';
import type { EmailService, HostEmailTemplateKey } from '../services/email.service.js';
import { Pbkdf2PasswordHasher } from '../services/password-hasher.js';
import { InMemoryRateLimiter } from '../services/rate-limiter.js';
import { createApp } from '../app.js';

describe.skipIf(process.env.DATABASE_URL === undefined)('host authentication HTTP flow', () => {
  let client: DbClient;
  let mailer: RecordingEmailService;

  beforeAll(async () => {
    client = await createTestDatabase();
    mailer = new RecordingEmailService();
  });

  afterAll(async () => {
    await client?.close();
  });

  it('supports account signup, authentication, tier changes, reset and logout', async () => {
    const config = loadConfig({
      ...process.env,
      APP_ENV: 'test',
      PASSWORD_HASH_ITERATIONS: '1000',
      ENABLE_EMAIL_VERIFICATION: 'false'
    });
    const app = createAuthApp(config, client, mailer);
    const signup = await request(app).post('/api/v1/host/auth/signup').send({
      username: 'LiveHost',
      password: 'LiveHostPassword123!',
      email: 'live-host@example.test',
      accountType: 'LONG_TERM',
      termsAccepted: true
    });

    expect(signup.status).toBe(201);
    expect(signup.body).toEqual({ accountType: 'LONG_TERM' });
    const setCookieHeader = signup.headers['set-cookie']?.[0];
    expect(setCookieHeader).toContain('HttpOnly; Secure; SameSite=Lax');
    if (!setCookieHeader) {
      throw new Error('Signup did not issue the host session cookie');
    }
    const cookie = setCookieHeader.split(';')[0];
    if (!cookie) {
      throw new Error('Signup returned a malformed session cookie');
    }

    const profile = await request(app).get('/api/v1/host/auth/me').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.host).toMatchObject({
      username: 'livehost',
      email: 'live-host@example.test'
    });
    expect(profile.body.host.passwordHash).toBeUndefined();

    for (const duplicate of [
      {
        username: 'livehost',
        password: 'AnotherPassword123!',
        email: 'second@example.test',
        accountType: 'LONG_TERM',
        termsAccepted: true
      },
      {
        username: 'secondhost',
        password: 'AnotherPassword123!',
        email: 'live-host@example.test',
        accountType: 'LONG_TERM',
        termsAccepted: true
      }
    ]) {
      expect((await request(app).post('/api/v1/host/auth/signup').send(duplicate)).status).toBe(
        409
      );
    }

    const wrongPassword = await request(app)
      .post('/api/v1/host/auth/login')
      .send({ username: 'livehost', password: 'IncorrectPassword123!' });
    const unknownUser = await request(app)
      .post('/api/v1/host/auth/login')
      .send({ username: 'missinghost', password: 'IncorrectPassword123!' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.key).toBe(unknownUser.body.error.key);

    const downgradeBlocked = await request(app)
      .post('/api/v1/host/auth/change-tier')
      .set('Cookie', cookie)
      .send({ accountType: 'TEMPORARY' });
    expect(downgradeBlocked.status).toBe(400);
    const downgrade = await request(app)
      .post('/api/v1/host/auth/change-tier')
      .set('Cookie', cookie)
      .send({ accountType: 'TEMPORARY', confirm: 'DELETE' });
    expect(downgrade.body.host.accountType).toBe('TEMPORARY');
    expect(downgrade.body.host.purgeAt).toBeTruthy();

    const unknownForgot = await request(app)
      .post('/api/v1/host/auth/forgot-password')
      .send({ email: 'unknown@example.test' });
    const knownForgot = await request(app)
      .post('/api/v1/host/auth/forgot-password')
      .send({ email: 'live-host@example.test' });
    expect(unknownForgot.status).toBe(202);
    expect(knownForgot.status).toBe(202);
    expect(unknownForgot.body).toEqual(knownForgot.body);
    const resetToken = new URL(mailer.messages[0]?.link ?? '').searchParams.get('token');
    expect(resetToken).toBeTruthy();

    const reset = await request(app)
      .post('/api/v1/host/auth/reset-password')
      .send({ token: resetToken, password: 'ResetPassword123!secure' });
    expect(reset.status).toBe(200);
    const usedAgain = await request(app)
      .post('/api/v1/host/auth/reset-password')
      .send({ token: resetToken, password: 'OtherPassword123!secure' });
    expect(usedAgain.status).toBe(400);

    const logout = await request(app).post('/api/v1/host/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('Max-Age=0');
  });

  it('blocks login until a verification link is used when verification is enabled', async () => {
    const config = loadConfig({
      ...process.env,
      APP_ENV: 'test',
      PASSWORD_HASH_ITERATIONS: '1000',
      ENABLE_EMAIL_VERIFICATION: 'true'
    });
    const app = createAuthApp(config, client, mailer);
    const signup = await request(app).post('/api/v1/host/auth/signup').send({
      username: 'verifyhost',
      password: 'VerifyHostPassword123!',
      email: 'verify-host@example.test',
      accountType: 'LONG_TERM',
      termsAccepted: true
    });
    expect(signup.status).toBe(202);
    expect(signup.headers['set-cookie']).toBeUndefined();

    const blocked = await request(app)
      .post('/api/v1/host/auth/login')
      .send({ username: 'verifyhost', password: 'VerifyHostPassword123!' });
    expect(blocked.status).toBe(401);

    const verificationLink = mailer.messages.find((message) => message.key === 'host.verify_email');
    const verificationToken = new URL(verificationLink?.link ?? '').searchParams.get('token');
    expect(verificationToken).toBeTruthy();
    const verified = await request(app).get('/api/v1/host/auth/verify-email').query({
      token: verificationToken
    });
    expect(verified.status).toBe(200);

    const allowed = await request(app)
      .post('/api/v1/host/auth/login')
      .send({ username: 'verifyhost', password: 'VerifyHostPassword123!' });
    expect(allowed.status).toBe(200);
  });

  it('updates the profile and password, exports data, and deletes the account', async () => {
    const config = loadConfig({
      ...process.env,
      APP_ENV: 'test',
      PASSWORD_HASH_ITERATIONS: '1000',
      ENABLE_EMAIL_VERIFICATION: 'false'
    });
    const app = createAuthApp(config, client, mailer);
    const signup = await request(app).post('/api/v1/host/auth/signup').send({
      username: 'deletehost',
      password: 'DeleteHostPassword123!',
      email: 'delete-host@example.test',
      accountType: 'LONG_TERM',
      termsAccepted: true
    });
    const setCookieHeader = signup.headers['set-cookie']?.[0];
    if (!setCookieHeader) {
      throw new Error('Signup did not issue the host session cookie');
    }
    const cookie = setCookieHeader.split(';')[0];
    if (!cookie) {
      throw new Error('Signup returned a malformed session cookie');
    }

    const profile = await request(app)
      .patch('/api/v1/host/auth/profile')
      .set('Cookie', cookie)
      .send({ username: 'renamedhost', email: 'renamed@example.test' });
    expect(profile.status).toBe(200);
    expect(profile.body.host).toMatchObject({
      username: 'renamedhost',
      email: 'renamed@example.test'
    });

    const exported = await request(app).post('/api/v1/host/auth/export-data').set('Cookie', cookie);
    expect(exported.status).toBe(200);
    expect(exported.body.profile.passwordHash).toBeUndefined();
    expect(exported.body.castVotes).toEqual([]);
    expect(exported.body.registeredVoters).toEqual([]);

    const passwordChange = await request(app)
      .post('/api/v1/host/auth/change-password')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'DeleteHostPassword123!',
        newPassword: 'ChangedHostPassword456!'
      });
    expect(passwordChange.status).toBe(200);
    expect((await request(app).get('/api/v1/host/auth/me').set('Cookie', cookie)).status).toBe(200);

    const deletion = await request(app)
      .delete('/api/v1/host/auth/account')
      .set('Cookie', cookie)
      .send({ confirm: 'DELETE' });
    expect(deletion.status).toBe(204);
    expect((await request(app).get('/api/v1/host/auth/me').set('Cookie', cookie)).status).toBe(401);
  });
});

function createAuthApp(
  config: ReturnType<typeof loadConfig>,
  client: DbClient,
  mailer: EmailService
) {
  const dependencies = createContainer(config, {
    createDatabaseClient: async () => client,
    emailService: mailer,
    passwordHasher: new Pbkdf2PasswordHasher(config.passwordHashIterations),
    rateLimiter: new InMemoryRateLimiter(30)
  });
  return createApp(dependencies);
}

class RecordingEmailService implements EmailService {
  readonly messages: Array<{ key: HostEmailTemplateKey; link: string }> = [];

  async send(
    key: HostEmailTemplateKey,
    _recipient: string,
    values: { link: string }
  ): Promise<void> {
    this.messages.push({ key, link: values.link });
  }
}
