import type { AppConfig } from '../config/env.js';
import { AppError, ConflictError, UnauthorizedError } from '../core/app-error.js';
import {
  base64urlDecode,
  base64urlEncode,
  MESSAGE_KEYS,
  randomBytes,
  sha256Hex
} from '../shared/index.js';
import type { HostProfile, HostAuthRepositoryPort } from './host-auth.repository.js';
import { EmailDeliveryError, type EmailService } from './email.service.js';
import type { PasswordHasher } from './password-hasher.js';
import type { RateLimiter } from './rate-limiter.js';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export interface SignupInput {
  username: string;
  password: string;
  email: string;
  accountType: 'TEMPORARY' | 'LONG_TERM';
}

export interface AuthResult {
  accountType: 'TEMPORARY' | 'LONG_TERM';
  host: HostProfile;
  sessionToken?: string;
  verificationRequired: boolean;
}

export interface LoginResult {
  host: HostProfile;
  sessionToken: string;
}

export interface AuthenticatedHost {
  host: HostProfile;
  sessionId: string;
}

export interface HostAuthServiceDependencies {
  config: Pick<AppConfig, 'appBaseUrl' | 'passwordHashIterations' | 'enableEmailVerification'>;
  passwordHasher: PasswordHasher;
  emailService: EmailService;
  rateLimiter: RateLimiter;
  now?: () => Date;
}

export class HostAuthService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: HostAuthRepositoryPort,
    private readonly dependencies: HostAuthServiceDependencies
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async signup(input: SignupInput): Promise<AuthResult> {
    const now = this.now();
    const passwordHash = await this.dependencies.passwordHasher.hash(input.password);
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    let created;
    try {
      created = await this.repository.withTransaction(async (repository) => {
        const existingUsername = await repository.findUserByUsername(username);
        if (existingUsername) {
          throw new ConflictError(MESSAGE_KEYS.errors.hostAuth.usernameTaken);
        }
        const existingEmail = await repository.findUserByEmail(email);
        if (existingEmail) {
          throw new ConflictError(MESSAGE_KEYS.errors.hostAuth.emailTaken);
        }

        const user = await repository.createUser({
          username,
          email,
          passwordHash,
          accountType: input.accountType,
          plan: 'FREE',
          lastLoginAt: this.dependencies.config.enableEmailVerification ? null : now,
          emailVerifiedAt: null,
          purgeAt: input.accountType === 'TEMPORARY' ? addDays(now, 7) : null
        });
        if (!user) {
          throw new AppError('errors.internal', 500);
        }

        if (this.dependencies.config.enableEmailVerification) {
          return { user, sessionToken: undefined };
        }
        return { user, sessionToken: await this.createSession(repository, user.id, now) };
      });
    } catch (error) {
      throw mapUniqueConflict(error);
    }

    if (this.dependencies.config.enableEmailVerification) {
      try {
        await this.sendVerificationEmail(created.user.id, created.user.email, now);
      } catch (error) {
        await this.repository.deleteAccount(created.user.id);
        throw error;
      }
    }
    return {
      accountType: created.user.accountType,
      host: toHostProfile(created.user),
      ...(created.sessionToken === undefined ? {} : { sessionToken: created.sessionToken }),
      verificationRequired: this.dependencies.config.enableEmailVerification
    };
  }

  async login(username: string, password: string, ip: string): Promise<LoginResult> {
    const canonicalUsername = username.trim().toLowerCase();
    const ipAllowed = this.dependencies.rateLimiter.consume(`login:ip:${ip}`);
    const usernameAllowed = this.dependencies.rateLimiter.consume(
      `login:username:${canonicalUsername}`
    );
    if (!ipAllowed || !usernameAllowed) {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.rateLimited, 429);
    }

    const user = await this.repository.findUserByUsername(canonicalUsername);
    const dummyHash = `pbkdf2-sha256$${this.dependencies.config.passwordHashIterations}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const matches = await this.dependencies.passwordHasher.verify(
      password,
      user?.passwordHash ?? dummyHash
    );
    if (
      !user ||
      !matches ||
      (this.dependencies.config.enableEmailVerification && user.emailVerifiedAt === null)
    ) {
      throw new UnauthorizedError(MESSAGE_KEYS.errors.hostAuth.invalidCredentials);
    }

    const now = this.now();
    const { updated, sessionToken } = await this.repository.withTransaction(async (repository) => {
      const updatedUser = await repository.updateUser(user.id, {
        lastLoginAt: now,
        ...(user.accountType === 'LONG_TERM'
          ? { inactivityWarningSentAt: null, purgeAt: null }
          : {})
      });
      if (!updatedUser) {
        throw new UnauthorizedError(MESSAGE_KEYS.errors.hostAuth.invalidCredentials);
      }
      return {
        updated: updatedUser,
        sessionToken: await this.createSession(repository, user.id, now)
      };
    });
    return { host: toHostProfile(updated), sessionToken };
  }

  async authenticate(sessionToken: string): Promise<AuthenticatedHost | undefined> {
    const bytes = decodeOpaqueToken(sessionToken);
    if (!bytes) {
      return undefined;
    }
    const sessionHash = await sha256Hex(sessionToken);
    const record = await this.repository.findSessionWithUser(sessionHash, this.now());
    if (!record) {
      return undefined;
    }
    return { host: toHostProfile(record.user), sessionId: record.session.id };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) {
      return;
    }
    const authenticated = await this.authenticate(sessionToken);
    if (authenticated) {
      await this.repository.revokeSession(authenticated.sessionId, this.now());
    }
  }

  async forgotPassword(email: string, ip: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const ipAllowed = this.dependencies.rateLimiter.consume(`forgot:ip:${ip}`);
    const emailAllowed = this.dependencies.rateLimiter.consume(`forgot:email:${normalizedEmail}`);
    if (!ipAllowed || !emailAllowed) {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.rateLimited, 429);
    }
    const user = await this.repository.findUserByEmail(normalizedEmail);
    if (!user) {
      return;
    }

    const now = this.now();
    const tokenBytes = randomBytes(32);
    const rawToken = base64urlEncode(tokenBytes);
    const tokenHash = await sha256Hex(rawToken);
    await this.repository.createResetToken({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS)
    });
    try {
      await this.dependencies.emailService.send('host.reset_password', user.email, {
        link: this.createLink('reset-password', rawToken)
      });
    } catch (error) {
      if (!(error instanceof EmailDeliveryError)) {
        throw error;
      }
      await this.repository.deleteResetTokensForUser(user.id);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const bytes = decodeOpaqueToken(token);
    if (!bytes) {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.resetTokenInvalid, 400);
    }
    const tokenHash = await sha256Hex(token);
    const passwordHash = await this.dependencies.passwordHasher.hash(newPassword);
    const now = this.now();
    const reset = await this.repository.withTransaction(async (repository) => {
      const record = await repository.findUsableResetToken(tokenHash, now);
      if (!record) {
        return false;
      }
      const marked = await repository.markResetTokenUsed(record.id, now);
      if (!marked) {
        return false;
      }
      const user = await repository.updateUser(record.userId, { passwordHash });
      if (!user) {
        throw new AppError('errors.internal', 500);
      }
      await repository.deleteSessionsForUser(record.userId);
      await repository.deleteResetTokensForUser(record.userId);
      return true;
    });
    if (!reset) {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.resetTokenInvalid, 400);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const bytes = decodeOpaqueToken(token);
    if (!bytes) {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.verificationTokenInvalid, 400);
    }
    const tokenHash = await sha256Hex(token);
    const now = this.now();
    const verified = await this.repository.withTransaction(async (repository) => {
      const record = await repository.findVerificationTokenWithUser(tokenHash, now);
      if (!record || !(await repository.markVerificationTokenUsed(record.token.id, now))) {
        return false;
      }
      const user = await repository.updateUser(record.user.id, { emailVerifiedAt: now });
      if (!user) {
        throw new AppError('errors.internal', 500);
      }
      return true;
    });
    if (!verified) {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.verificationTokenInvalid, 400);
    }
  }

  async updateProfile(
    hostId: string,
    updates: { username?: string; email?: string }
  ): Promise<{ host: HostProfile; verificationRequired: boolean }> {
    const current = await this.requireUser(hostId);
    updates = {
      ...(updates.username === undefined
        ? {}
        : { username: updates.username.trim().toLowerCase() }),
      ...(updates.email === undefined ? {} : { email: updates.email.trim().toLowerCase() })
    };
    if (updates.username !== undefined && updates.username !== current.username) {
      if (await this.repository.findUserByUsername(updates.username)) {
        throw new ConflictError(MESSAGE_KEYS.errors.hostAuth.usernameTaken);
      }
    }
    if (updates.email !== undefined && updates.email !== current.email) {
      if (await this.repository.findUserByEmail(updates.email)) {
        throw new ConflictError(MESSAGE_KEYS.errors.hostAuth.emailTaken);
      }
    }
    const emailChanged = updates.email !== undefined && updates.email !== current.email;
    const update = {
      ...updates,
      ...(emailChanged ? { emailVerifiedAt: null } : {})
    };
    let user;
    try {
      user = await this.repository.updateUser(hostId, update);
    } catch (error) {
      throw mapUniqueConflict(error);
    }
    if (!user) {
      throw new UnauthorizedError();
    }
    if (emailChanged && this.dependencies.config.enableEmailVerification) {
      try {
        await this.sendVerificationEmail(user.id, user.email, this.now());
      } catch (error) {
        await this.repository.withTransaction(async (repository) => {
          await repository.updateUser(hostId, {
            email: current.email,
            emailVerifiedAt: current.emailVerifiedAt
          });
          await repository.deleteVerificationTokensForUser(hostId);
        });
        throw error;
      }
    }
    return {
      host: toHostProfile(user),
      verificationRequired: emailChanged && this.dependencies.config.enableEmailVerification
    };
  }

  async changePassword(
    hostId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string
  ): Promise<void> {
    const user = await this.requireUser(hostId);
    if (!(await this.dependencies.passwordHasher.verify(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError(MESSAGE_KEYS.errors.hostAuth.currentPasswordInvalid);
    }
    const passwordHash = await this.dependencies.passwordHasher.hash(newPassword);
    await this.repository.withTransaction(async (repository) => {
      const updated = await repository.updateUser(hostId, { passwordHash });
      if (!updated) {
        throw new UnauthorizedError();
      }
      await repository.deleteSessionsForUserExcept(hostId, currentSessionId);
      await repository.deleteResetTokensForUser(hostId);
    });
  }

  async changeTier(
    hostId: string,
    accountType: 'TEMPORARY' | 'LONG_TERM',
    confirm: string | undefined
  ): Promise<HostProfile> {
    const user = await this.requireUser(hostId);
    if (user.accountType === 'LONG_TERM' && accountType === 'TEMPORARY' && confirm !== 'DELETE') {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.tierDowngradeConfirmationRequired, 400);
    }
    const purgeAt =
      accountType === 'LONG_TERM'
        ? null
        : user.accountType === 'TEMPORARY'
          ? user.purgeAt
          : addDays(this.now(), 7);
    const updated = await this.repository.updateUser(hostId, {
      accountType,
      purgeAt,
      inactivityWarningSentAt: null
    });
    if (!updated) {
      throw new UnauthorizedError();
    }

    return toHostProfile(updated);
  }

  async exportData(hostId: string): Promise<Record<string, unknown>> {
    const data = await this.repository.exportAccount(hostId);
    if (!data) {
      throw new UnauthorizedError();
    }
    return data;
  }

  async deleteAccount(hostId: string, confirmation: string): Promise<void> {
    if (confirmation !== 'DELETE') {
      throw new AppError(MESSAGE_KEYS.errors.hostAuth.accountDeletionConfirmationRequired, 400);
    }
    if (!(await this.repository.deleteAccount(hostId))) {
      throw new UnauthorizedError();
    }
  }

  private async sendVerificationEmail(userId: string, email: string, now: Date): Promise<void> {
    const tokenBytes = randomBytes(32);
    const token = base64urlEncode(tokenBytes);
    await this.repository.createVerificationToken({
      userId,
      tokenHash: await sha256Hex(token),
      expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS)
    });
    await this.dependencies.emailService.send('host.verify_email', email, {
      link: this.createLink('verify-email', token)
    });
  }

  private async createSession(
    repository: HostAuthRepositoryPort,
    userId: string,
    now: Date
  ): Promise<string> {
    const tokenBytes = randomBytes(32);
    const token = base64urlEncode(tokenBytes);
    const session = await repository.createSession({
      userId,
      tokenHash: await sha256Hex(token),
      expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS)
    });
    if (!session) {
      throw new AppError('errors.internal', 500);
    }
    return token;
  }

  private createLink(path: string, token: string): string {
    const url = new URL(`/${path}`, this.dependencies.config.appBaseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private async requireUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    return user;
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function decodeOpaqueToken(token: string): Uint8Array | undefined {
  try {
    const bytes = base64urlDecode(token);
    return bytes.length === 32 && base64urlEncode(bytes) === token ? bytes : undefined;
  } catch (error) {
    if (error instanceof TypeError) {
      return undefined;
    }
    throw error;
  }
}

function toHostProfile(user: {
  id: string;
  username: string;
  email: string;
  accountType: 'TEMPORARY' | 'LONG_TERM';
  plan: 'FREE' | 'PAY_PER_USE' | 'PREMIUM';
  createdAt: Date;
  purgeAt: Date | null;
  lastLoginAt: Date | null;
}): HostProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accountType: user.accountType,
    plan: user.plan,
    createdAt: user.createdAt,
    purgeAt: user.purgeAt,
    lastLoginAt: user.lastLoginAt
  };
}

function mapUniqueConflict(error: unknown): unknown {
  if (error === null || typeof error !== 'object') {
    return error;
  }
  const candidate = error as { constraint?: unknown; cause?: { constraint?: unknown } };
  const constraint = candidate.constraint ?? candidate.cause?.constraint;
  if (constraint === 'users_username_unique') {
    return new ConflictError(MESSAGE_KEYS.errors.hostAuth.usernameTaken);
  }
  if (constraint === 'users_email_unique') {
    return new ConflictError(MESSAGE_KEYS.errors.hostAuth.emailTaken);
  }
  return error;
}
