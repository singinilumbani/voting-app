import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError, ValidationError } from '../core/app-error.js';
import type { VotingService } from '../services/voting.service.js';

const enterSchema = z.object({
  token: z.string().min(1).max(64),
  phone: z.string().max(100).optional()
});

const submitSchema = z
  .object({
    selections: z
      .array(
        z.object({
          categoryId: z.uuid(),
          candidateId: z.union([z.uuid(), z.literal('ABSTAIN')])
        })
      )
      .max(100),
    deviceUuid: z.uuid().optional(),
    fingerprintHash: z.string().min(1).max(512).optional()
  })
  .strict()
  .refine((value) => (value.deviceUuid === undefined) === (value.fingerprintHash === undefined), {
    message: 'device-and-fingerprint-required-together'
  });

export class VotingController {
  readonly enter: RequestHandler = async (request, response) => {
    const input = parseBody(enterSchema, request.body);
    const result = await this.serviceFor(response).enter(
      param(request, 'publicId'),
      input.token,
      input.phone,
      request.ip ?? 'unknown'
    );
    if (result.alreadyVoted) {
      response.status(409).json({
        error: {
          key: 'errors.vote.already_voted',
          requestId: response.locals.requestId ?? 'unavailable'
        },
        ...(result.resultsAccessToken ? { resultsAccessToken: result.resultsAccessToken } : {})
      });
      return;
    }
    response.status(200).json(result);
  };

  readonly submit: RequestHandler = async (request, response) => {
    const input = parseBody(submitSchema, request.body);
    if (input.deviceUuid && input.fingerprintHash) {
      if (bearerToken(request.headers.authorization)) {
        throw new ValidationError({ reason: 'errors.validation' });
      }
      response
        .status(200)
        .json(
          await this.serviceFor(response).submitPublic(
            param(request, 'publicId'),
            input.selections,
            input.deviceUuid,
            input.fingerprintHash
          )
        );
      return;
    }
    const session = bearerToken(request.headers.authorization);
    if (!session) throw new AppError('errors.vote.session_invalid', 401);
    const result = await this.serviceFor(response).submitClosed(
      param(request, 'publicId'),
      session,
      input.selections
    );
    if (result.alreadyVoted) {
      response.status(409).json({
        error: {
          key: 'errors.vote.already_voted',
          requestId: response.locals.requestId ?? 'unavailable'
        },
        ...(result.resultsAccessToken ? { resultsAccessToken: result.resultsAccessToken } : {})
      });
      return;
    }
    response.status(200).json(result);
  };

  readonly results: RequestHandler = async (request, response) => {
    response
      .status(200)
      .json(
        await this.serviceFor(response).results(
          param(request, 'publicId'),
          bearerToken(request.headers.authorization)
        )
      );
  };

  private serviceFor(response: Response): VotingService {
    const service = response.locals.votingService;
    if (!service) throw new AppError('errors.vote.not_configured', 503);
    return service;
  }
}

function bearerToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/u.exec(value);
  return match?.[1];
}

function param(request: Parameters<RequestHandler>[0], key: string): string {
  const value = request.params[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError({ reason: 'errors.validation' });
  }
  return value;
}

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError({ reason: 'errors.validation' });
  return result.data;
}
