import type { emailVerificationTokens } from '../db/schema/email-verification-tokens.js';
import type { passwordResetTokens } from '../db/schema/password-reset-tokens.js';
import type { sessions } from '../db/schema/sessions.js';
import type { users } from '../db/schema/users.js';

type UserRecord = typeof users.$inferSelect;
type SessionRecord = typeof sessions.$inferSelect;
type ResetTokenRecord = typeof passwordResetTokens.$inferSelect;
type VerificationTokenRecord = typeof emailVerificationTokens.$inferSelect;

export interface HostProfile {
  id: string;
  username: string;
  email: string;
  accountType: UserRecord['accountType'];
  plan: UserRecord['plan'];
  createdAt: Date;
  purgeAt: Date | null;
  lastLoginAt: Date | null;
}

export interface HostAuthRepositoryPort {
  withTransaction<T>(operation: (repository: HostAuthRepositoryPort) => Promise<T>): Promise<T>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  findUserByUsername(username: string): Promise<UserRecord | undefined>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  createUser(values: typeof users.$inferInsert): Promise<UserRecord | undefined>;
  updateUser(
    id: string,
    values: Partial<typeof users.$inferInsert>
  ): Promise<UserRecord | undefined>;
  createSession(values: typeof sessions.$inferInsert): Promise<SessionRecord | undefined>;
  findSessionWithUser(
    tokenHash: string,
    now: Date
  ): Promise<{ session: SessionRecord; user: UserRecord } | undefined>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
  createResetToken(
    values: typeof passwordResetTokens.$inferInsert
  ): Promise<ResetTokenRecord | undefined>;
  findUsableResetToken(tokenHash: string, now: Date): Promise<ResetTokenRecord | undefined>;
  markResetTokenUsed(id: string, now: Date): Promise<ResetTokenRecord | undefined>;
  deleteResetTokensForUser(userId: string): Promise<void>;
  createVerificationToken(
    values: typeof emailVerificationTokens.$inferInsert
  ): Promise<VerificationTokenRecord | undefined>;
  findUsableVerificationToken(
    tokenHash: string,
    now: Date
  ): Promise<VerificationTokenRecord | undefined>;
  findVerificationTokenWithUser(
    tokenHash: string,
    now: Date
  ): Promise<{ token: VerificationTokenRecord; user: UserRecord } | undefined>;
  markVerificationTokenUsed(id: string, now: Date): Promise<VerificationTokenRecord | undefined>;
  deleteVerificationTokensForUser(userId: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  deleteSessionsForUserExcept(userId: string, sessionId: string): Promise<void>;
  exportAccount(hostId: string): Promise<Record<string, unknown> | undefined>;
  deleteAccount(hostId: string): Promise<boolean>;
}
