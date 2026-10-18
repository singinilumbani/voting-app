import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../core/app-error.js';
import type { emailVerificationTokens } from '../db/schema/email-verification-tokens.js';
import type { passwordResetTokens } from '../db/schema/password-reset-tokens.js';
import type { sessions } from '../db/schema/sessions.js';
import type { users } from '../db/schema/users.js';
import { sha256Hex } from '../shared/crypto/crypto.js';
import {
  EmailDeliveryError,
  type EmailService,
  type HostEmailTemplateKey
} from './email.service.js';
import type { HostAuthRepositoryPort } from './host-auth.repository.js';
import { HostAuthService } from './host-auth.service.js';
import { Pbkdf2PasswordHasher } from './password-hasher.js';
import { InMemoryRateLimiter } from './rate-limiter.js';

type User = typeof users.$inferSelect;
type Session = typeof sessions.$inferSelect;
type ResetToken = typeof passwordResetTokens.$inferSelect;
type VerificationToken = typeof emailVerificationTokens.$inferSelect;

const fixedNow = new Date('2026-10-18T08:00:00.000Z');
const validSignup = {
  username: 'HostOne',
  password: 'SecurePassword123!',
  email: 'host@example.test',
  accountType: 'TEMPORARY' as const
};

describe('HostAuthService', () => {
  it('signs up a temporary host with a session and purge deadline', async () => {
    const context = createContext(false);
    const result = await context.service.signup(validSignup);
    const user = await context.repository.findUserByUsername('hostone');

    expect(result.accountType).toBe('TEMPORARY');
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(result.verificationRequired).toBe(false);
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.lastLoginAt).toEqual(fixedNow);
    expect(user?.purgeAt).toEqual(new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000));
    expect(user?.passwordHash).toMatch(/^pbkdf2-sha256\$1000\$/u);
  });

  it('rejects duplicate usernames and emails independently', async () => {
    const context = createContext(false);
    await context.service.signup(validSignup);

    await expect(
      context.service.signup({ ...validSignup, email: 'another@example.test' })
    ).rejects.toMatchObject({ key: 'errors.host_auth.username_taken' });
    await expect(
      context.service.signup({ ...validSignup, username: 'anotherhost' })
    ).rejects.toMatchObject({ key: 'errors.host_auth.email_taken' });
  });

  it('uses the same login failure message for an unknown username and a wrong password', async () => {
    const context = createContext(false);
    await context.service.signup(validSignup);

    const wrongPassword = await context.service
      .login('hostone', 'WrongPassword123!', '192.0.2.1')
      .catch((error: unknown) => error);
    const unknownUsername = await context.service
      .login('not-a-host', 'WrongPassword123!', '192.0.2.2')
      .catch((error: unknown) => error);

    expect(wrongPassword).toBeInstanceOf(UnauthorizedError);
    expect(unknownUsername).toBeInstanceOf(UnauthorizedError);
    expect(errorKey(wrongPassword)).toBe(errorKey(unknownUsername));
  });

  it('requires explicit confirmation to downgrade and sets or clears purge_at', async () => {
    const context = createContext(false);
    await context.service.signup({ ...validSignup, accountType: 'LONG_TERM' });
    const host = await context.repository.findUserByUsername('hostone');
    if (!host) {
      throw new Error('Expected created host');
    }

    await expect(context.service.changeTier(host.id, 'TEMPORARY', undefined)).rejects.toMatchObject(
      {
        key: 'errors.host_auth.tier_downgrade_confirmation_required'
      }
    );
    const downgraded = await context.service.changeTier(host.id, 'TEMPORARY', 'DELETE');
    expect(downgraded.purgeAt).toEqual(new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000));
    const upgraded = await context.service.changeTier(host.id, 'LONG_TERM', undefined);
    expect(upgraded.purgeAt).toBeNull();
  });

  it('sends neutral reset responses and consumes a valid reset token once', async () => {
    const context = createContext(false);
    await context.service.signup({ ...validSignup, accountType: 'LONG_TERM' });
    await context.service.forgotPassword('absent@example.test', '192.0.2.10');
    expect(context.email.messages).toHaveLength(0);

    await context.service.forgotPassword(validSignup.email, '192.0.2.10');
    expect(context.email.messages).toHaveLength(1);
    const link = new URL(context.email.messages[0]?.link ?? '');
    const token = link.searchParams.get('token');
    expect(token).toBeTruthy();
    const stored = [...context.resetTokens.values()][0];
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(stored?.expiresAt).toEqual(new Date(fixedNow.getTime() + 60 * 60 * 1000));

    await context.service.resetPassword(token ?? '', 'AnotherSecurePassword456!');
    const user = await context.repository.findUserByEmail(validSignup.email);
    expect(await context.hasher.verify('AnotherSecurePassword456!', user?.passwordHash ?? '')).toBe(
      true
    );
    await expect(
      context.service.resetPassword(token ?? '', 'YetAnotherPassword789!')
    ).rejects.toMatchObject({ key: 'errors.host_auth.reset_token_invalid' });
  });

  it('keeps forgot-password responses neutral when mail delivery fails', async () => {
    const context = createContext(false);
    await context.service.signup({ ...validSignup, accountType: 'LONG_TERM' });
    context.email.failDelivery = true;

    await expect(
      context.service.forgotPassword(validSignup.email, '192.0.2.30')
    ).resolves.toBeUndefined();
    expect(context.resetTokens.size).toBe(0);
  });

  it('requires verification before login only when email verification is enabled', async () => {
    const context = createContext(true);
    const signup = await context.service.signup(validSignup);
    expect(signup.verificationRequired).toBe(true);
    expect(signup.sessionToken).toBeUndefined();
    expect(context.email.messages[0]?.key).toBe('host.verify_email');
    await expect(
      context.service.login('hostone', validSignup.password, '192.0.2.20')
    ).rejects.toMatchObject({ key: 'errors.host_auth.invalid_credentials' });

    const verificationLink = new URL(context.email.messages[0]?.link ?? '');
    const token = verificationLink.searchParams.get('token');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    const tokenHash = await sha256Hex(token ?? '');
    expect([...context.verificationTokens.values()][0]?.tokenHash).toBe(tokenHash);

    await context.service.verifyEmail(token ?? '');
    const login = await context.service.login('hostone', validSignup.password, '192.0.2.20');
    expect(login.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });
});

function createContext(enableEmailVerification: boolean) {
  const usersById = new Map<string, User>();
  const sessionsById = new Map<string, Session>();
  const resetTokens = new Map<string, ResetToken>();
  const verificationTokens = new Map<string, VerificationToken>();
  const email = new MemoryEmailService();
  const hasher = new Pbkdf2PasswordHasher(1_000);
  const now = () => new Date(fixedNow);

  const repository: HostAuthRepositoryPort = {
    async withTransaction<T>(operation: (repo: HostAuthRepositoryPort) => Promise<T>) {
      return operation(repository);
    },
    async findUserById(id) {
      return usersById.get(id);
    },
    async findUserByUsername(username) {
      return [...usersById.values()].find((user) => user.username === username);
    },
    async findUserByEmail(emailValue) {
      return [...usersById.values()].find((user) => user.email === emailValue);
    },
    async createUser(values) {
      const user: User = {
        id: randomUUID(),
        username: values.username ?? '',
        passwordHash: values.passwordHash ?? '',
        email: values.email ?? '',
        accountType: values.accountType ?? 'TEMPORARY',
        plan: values.plan ?? 'FREE',
        lastLoginAt: values.lastLoginAt ?? null,
        emailVerifiedAt: values.emailVerifiedAt ?? null,
        purgeAt: values.purgeAt ?? null,
        inactivityWarningSentAt: values.inactivityWarningSentAt ?? null,
        createdAt: now()
      };
      usersById.set(user.id, user);
      return user;
    },
    async updateUser(id, values) {
      const existing = usersById.get(id);
      if (!existing) {
        return undefined;
      }
      const updated = { ...existing, ...values };
      usersById.set(id, updated);
      return updated;
    },
    async createSession(values) {
      const session: Session = {
        id: randomUUID(),
        userId: values.userId ?? '',
        tokenHash: values.tokenHash ?? '',
        expiresAt: values.expiresAt ?? now(),
        usedAt: values.usedAt ?? null,
        createdAt: now()
      };
      sessionsById.set(session.id, session);
      return session;
    },
    async findSessionWithUser(tokenHash, currentTime) {
      for (const session of sessionsById.values()) {
        const user = usersById.get(session.userId);
        if (
          session.tokenHash === tokenHash &&
          session.expiresAt > currentTime &&
          session.usedAt === null &&
          user
        ) {
          return { session, user };
        }
      }
      return undefined;
    },
    async revokeSession(sessionId, usedAt) {
      const session = sessionsById.get(sessionId);
      if (session) {
        sessionsById.set(sessionId, { ...session, usedAt });
      }
    },
    async createResetToken(values) {
      const token: ResetToken = {
        id: randomUUID(),
        userId: values.userId ?? '',
        tokenHash: values.tokenHash ?? '',
        expiresAt: values.expiresAt ?? now(),
        usedAt: values.usedAt ?? null,
        createdAt: now()
      };
      resetTokens.set(token.id, token);
      return token;
    },
    async findUsableResetToken(tokenHash, currentTime) {
      return [...resetTokens.values()].find(
        (token) =>
          token.tokenHash === tokenHash && token.expiresAt > currentTime && token.usedAt === null
      );
    },
    async markResetTokenUsed(id, usedAt) {
      const token = resetTokens.get(id);
      if (!token || token.usedAt !== null) {
        return undefined;
      }
      const used = { ...token, usedAt };
      resetTokens.set(id, used);
      return used;
    },
    async deleteResetTokensForUser(userId) {
      for (const [id, token] of resetTokens) {
        if (token.userId === userId) {
          resetTokens.delete(id);
        }
      }
    },
    async createVerificationToken(values) {
      const token: VerificationToken = {
        id: randomUUID(),
        userId: values.userId ?? '',
        tokenHash: values.tokenHash ?? '',
        expiresAt: values.expiresAt ?? now(),
        usedAt: values.usedAt ?? null,
        createdAt: now()
      };
      verificationTokens.set(token.id, token);
      return token;
    },
    async findUsableVerificationToken(tokenHash, currentTime) {
      return [...verificationTokens.values()].find(
        (token) =>
          token.tokenHash === tokenHash && token.expiresAt > currentTime && token.usedAt === null
      );
    },
    async findVerificationTokenWithUser(tokenHash, currentTime) {
      const token = await repository.findUsableVerificationToken(tokenHash, currentTime);
      const user = token ? usersById.get(token.userId) : undefined;
      return token && user ? { token, user } : undefined;
    },
    async markVerificationTokenUsed(id, usedAt) {
      const token = verificationTokens.get(id);
      if (!token || token.usedAt !== null) {
        return undefined;
      }
      const used = { ...token, usedAt };
      verificationTokens.set(id, used);
      return used;
    },
    async deleteVerificationTokensForUser(userId) {
      for (const [id, token] of verificationTokens) {
        if (token.userId === userId) {
          verificationTokens.delete(id);
        }
      }
    },
    async deleteSessionsForUser(userId) {
      for (const [id, session] of sessionsById) {
        if (session.userId === userId) {
          sessionsById.delete(id);
        }
      }
    },
    async deleteSessionsForUserExcept(userId, sessionId) {
      for (const [id, session] of sessionsById) {
        if (session.userId === userId && id !== sessionId) {
          sessionsById.delete(id);
        }
      }
    },
    async exportAccount(hostId) {
      return usersById.has(hostId) ? { hostId } : undefined;
    },
    async deleteAccount(hostId) {
      return usersById.delete(hostId);
    }
  };

  const service = new HostAuthService(repository, {
    config: {
      appBaseUrl: 'https://api.example.test',
      passwordHashIterations: 1_000,
      enableEmailVerification
    },
    passwordHasher: hasher,
    emailService: email,
    rateLimiter: new InMemoryRateLimiter(20, 15 * 60 * 1000),
    now
  });

  return { service, repository, hasher, email, resetTokens, verificationTokens };
}

class MemoryEmailService implements EmailService {
  readonly messages: Array<{ key: HostEmailTemplateKey; recipient: string; link: string }> = [];
  failDelivery = false;

  async send(
    key: HostEmailTemplateKey,
    recipient: string,
    values: { link: string }
  ): Promise<void> {
    if (this.failDelivery) {
      throw new EmailDeliveryError();
    }
    this.messages.push({ key, recipient, link: values.link });
  }
}

function errorKey(error: unknown): string | undefined {
  return error instanceof UnauthorizedError ? error.key : undefined;
}
