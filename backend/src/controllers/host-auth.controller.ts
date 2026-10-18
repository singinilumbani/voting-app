import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import { AppError, UnauthorizedError, ValidationError } from '../core/app-error.js';
import type { HostAuthService } from '../services/host-auth.service.js';
import { MESSAGE_KEYS } from '../shared/messages.js';
import { HOST_SESSION_COOKIE, readHostSessionCookie } from '../middleware/host-session.js';

const passwordSchema = z.string().min(12).max(256);
const signupSchema = z.object({
  username: z.string().regex(/^[A-Za-z0-9]{3,80}$/u),
  password: passwordSchema,
  email: z.email().max(320),
  accountType: z.enum(['TEMPORARY', 'LONG_TERM']),
  termsAccepted: z.literal(true)
});
const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(256)
});
const forgotPasswordSchema = z.object({ email: z.email().max(320) });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: passwordSchema });
const profileSchema = z
  .object({
    username: z
      .string()
      .regex(/^[A-Za-z0-9]{3,80}$/u)
      .optional(),
    email: z.email().max(320).optional()
  })
  .refine((value) => value.username !== undefined || value.email !== undefined);
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema
});
const changeTierSchema = z.object({
  accountType: z.enum(['TEMPORARY', 'LONG_TERM']),
  confirm: z.string().optional()
});
const confirmationSchema = z.object({ confirm: z.string() });
const verifyEmailQuerySchema = z.object({ token: z.string().min(1) });

export class HostAuthController {
  readonly signup: RequestHandler = async (request, response) => {
    const input = parseBody(signupSchema, request.body);
    const result = await this.serviceFor(response).signup({
      username: input.username.trim().toLowerCase(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      accountType: input.accountType
    });
    if (result.sessionToken) {
      response.setHeader('Set-Cookie', this.createSessionCookie(result.sessionToken));
    }
    response.status(result.verificationRequired ? 202 : 201).json({
      accountType: result.accountType
    });
  };

  readonly login: RequestHandler = async (request, response) => {
    const input = parseBody(loginSchema, request.body);
    const result = await this.serviceFor(response).login(
      input.username,
      input.password,
      request.ip ?? 'unknown'
    );
    response.setHeader('Set-Cookie', this.createSessionCookie(result.sessionToken));
    response.status(200).json({ host: result.host });
  };

  readonly logout: RequestHandler = async (request, response) => {
    await this.serviceFor(response).logout(readHostSessionCookie(request));
    response.setHeader('Set-Cookie', this.clearSessionCookie());
    response.status(204).end();
  };

  readonly me: RequestHandler = (_request, response) => {
    if (!response.locals.authenticatedHost) {
      throw new UnauthorizedError();
    }
    response.status(200).json({ host: response.locals.authenticatedHost.host });
  };

  readonly forgotPassword: RequestHandler = async (request, response) => {
    const input = parseBody(forgotPasswordSchema, request.body);
    await this.serviceFor(response).forgotPassword(
      input.email.trim().toLowerCase(),
      request.ip ?? 'unknown'
    );
    response.status(202).json({ messageKey: MESSAGE_KEYS.status.hostAuth.passwordResetIfExists });
  };

  readonly resetPassword: RequestHandler = async (request, response) => {
    const input = parseBody(resetPasswordSchema, request.body);
    await this.serviceFor(response).resetPassword(input.token, input.password);
    response.status(200).json({ messageKey: MESSAGE_KEYS.status.hostAuth.passwordReset });
  };

  readonly verifyEmail: RequestHandler = async (request, response) => {
    const query = parseBody(verifyEmailQuerySchema, request.query);
    await this.serviceFor(response).verifyEmail(query.token);
    response.status(200).json({ messageKey: MESSAGE_KEYS.status.hostAuth.emailVerified });
  };

  readonly profile: RequestHandler = async (request, response) => {
    const host = this.authenticated(response);
    const input = parseBody(profileSchema, request.body);
    const result = await this.serviceFor(response).updateProfile(host.host.id, {
      ...(input.username === undefined ? {} : { username: input.username.trim().toLowerCase() }),
      ...(input.email === undefined ? {} : { email: input.email.trim().toLowerCase() })
    });
    response.status(200).json({
      host: result.host,
      verificationRequired: result.verificationRequired
    });
  };

  readonly changePassword: RequestHandler = async (request, response) => {
    const host = this.authenticated(response);
    const input = parseBody(changePasswordSchema, request.body);
    await this.serviceFor(response).changePassword(
      host.host.id,
      input.currentPassword,
      input.newPassword,
      host.sessionId
    );
    response.status(200).json({ messageKey: MESSAGE_KEYS.status.hostAuth.passwordChanged });
  };

  readonly changeTier: RequestHandler = async (request, response) => {
    const host = this.authenticated(response);
    const input = parseBody(changeTierSchema, request.body);
    const result = await this.serviceFor(response).changeTier(
      host.host.id,
      input.accountType,
      input.confirm
    );
    response.status(200).json({ host: result });
  };

  readonly exportData: RequestHandler = async (_request, response) => {
    const host = this.authenticated(response);
    const result = await this.serviceFor(response).exportData(host.host.id);
    response.status(200).json(result);
  };

  readonly deleteAccount: RequestHandler = async (request, response) => {
    const host = this.authenticated(response);
    const input = parseBody(confirmationSchema, request.body);
    await this.serviceFor(response).deleteAccount(host.host.id, input.confirm);
    response.setHeader('Set-Cookie', this.clearSessionCookie());
    response.status(204).end();
  };

  constructor(private readonly config: AppConfig) {}

  serviceFor(response: Response): HostAuthService {
    const service = response.locals.hostAuthService;
    if (!service) {
      throw new AppError('errors.auth.not_configured', 503);
    }
    return service;
  }

  private authenticated(response: Response) {
    const authenticated = response.locals.authenticatedHost;
    if (!authenticated) {
      throw new UnauthorizedError();
    }
    return authenticated;
  }

  private createSessionCookie(token: string): string {
    const parts = [
      `${HOST_SESSION_COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      `Max-Age=${30 * 24 * 60 * 60}`
    ];
    if (this.config.cookieDomain) {
      parts.push(`Domain=${this.config.cookieDomain}`);
    }
    return parts.join('; ');
  }

  private clearSessionCookie(): string {
    const parts = [
      `${HOST_SESSION_COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=0',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ];
    if (this.config.cookieDomain) {
      parts.push(`Domain=${this.config.cookieDomain}`);
    }
    return parts.join('; ');
  }
}

function parseBody<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError();
  }
  return parsed.data;
}
