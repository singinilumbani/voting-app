import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError, UnauthorizedError, ValidationError } from '../core/app-error.js';
import type { VoterService } from '../services/voter.service.js';

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().min(1).max(100),
  deviceUuid: z.uuid(),
  fingerprintHash: z.string().min(1).max(512)
});
const statusSchema = z.object({ token: z.string().min(1).max(64) });
const rejectSchema = z.object({ reason: z.string().trim().max(1000).optional() });
const bulkSchema = z
  .object({
    voterIds: z
      .array(z.uuid())
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    allPending: z.literal(true).optional(),
    reason: z.string().trim().max(1000).optional()
  })
  .refine(
    (value) => Number(value.allPending === true) + Number(value.voterIds !== undefined) === 1
  );
const listQuerySchema = z.object({
  search: z.string().max(200).optional().default(''),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'VOTED', 'REVOKED']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
});

export class VoterController {
  readonly register: RequestHandler = async (request, response) => {
    const input = parseBody(registerSchema, request.body);
    const result = await this.serviceFor(response).register(param(request, 'publicId'), {
      ...input,
      ip: request.ip ?? 'unknown'
    });
    response.status(201).json(result);
  };

  readonly status: RequestHandler = async (request, response) => {
    const { token } = parseBody(statusSchema, request.body);
    const result = await this.serviceFor(response).status(
      param(request, 'publicId'),
      token,
      request.ip ?? 'unknown'
    );
    response.status(200).json(result);
  };

  readonly list: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).list(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      parseBody(listQuerySchema, request.query)
    );
    response.status(200).json(result);
  };

  readonly approve: RequestHandler = async (request, response) => {
    const voter = await this.serviceFor(response).approve(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'voterId')
    );
    response.status(200).json({ voterId: voter?.id, status: voter?.approvalStatus });
  };

  readonly reject: RequestHandler = async (request, response) => {
    const { reason } = parseBody(rejectSchema, request.body ?? {});
    const voter = await this.serviceFor(response).reject(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'voterId'),
      reason
    );
    response.status(200).json({ voterId: voter?.id, status: voter?.approvalStatus });
  };

  readonly bulkApprove: RequestHandler = async (request, response) => {
    const input = parseBody(bulkSchema, request.body);
    const result = await this.serviceFor(response).bulkApprove(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      input
    );
    response.status(200).json(result);
  };

  readonly bulkReject: RequestHandler = async (request, response) => {
    const input = parseBody(bulkSchema, request.body);
    const result = await this.serviceFor(response).bulkReject(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      input
    );
    response.status(200).json(result);
  };

  readonly revoke: RequestHandler = async (request, response) => {
    const voter = await this.serviceFor(response).revoke(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'voterId')
    );
    response.status(200).json({ voterId: voter?.id, status: voter?.approvalStatus });
  };

  readonly reissueToken: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).reissueToken(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'voterId')
    );
    response.status(200).json(result);
  };

  readonly blockNumber: RequestHandler = async (request, response) => {
    await this.serviceFor(response).blockNumber(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'voterId')
    );
    response.status(204).end();
  };

  readonly integrity: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).integrity(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json(result);
  };

  readonly exportCsv: RequestHandler = async (request, response) => {
    const content = await this.serviceFor(response).exportCsv(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.type('text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="voters.csv"');
    response.status(200).send(content);
  };

  private serviceFor(response: Response): VoterService {
    const service = response.locals.voterService;
    if (!service) {
      throw new AppError('errors.registration.not_configured', 503);
    }
    return service;
  }
}

function authenticatedHost(response: Response) {
  const host = response.locals.authenticatedHost?.host;
  if (!host) throw new UnauthorizedError();
  return host;
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
  if (!result.success) {
    throw new ValidationError({ reason: 'errors.validation' });
  }
  return result.data;
}
