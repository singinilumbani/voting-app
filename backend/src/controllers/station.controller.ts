import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError, UnauthorizedError, ValidationError } from '../core/app-error.js';
import type { StationService } from '../services/station.service.js';
import { MESSAGE_KEYS } from '../shared/messages.js';

const stationCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).nullable().optional(),
  mode: z.enum(['PUBLIC_POLL', 'CLOSED_VOTE']),
  resultsVisibility: z.enum(['IMMEDIATE', 'CONCEALED']).optional(),
  allowAbstain: z.boolean(),
  mobileOnly: z.boolean()
});
const stationUpdateSchema = stationCreateSchema
  .omit({ mode: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
const categorySchema = z.object({ title: z.string().trim().min(1).max(200) });
const reorderSchema = z.object({ categoryIds: z.array(z.uuid()) });
const candidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  picture: z.string().url().max(2048).nullable().optional()
});
const candidateUpdateSchema = candidateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
const registrationConfigSchema = z.object({
  voterCap: z.number().int(),
  durationHours: z.number().int().optional().default(12)
});
const votingConfigSchema = z.object({
  startMode: z.enum(['NOW', 'SCHEDULED']),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().optional().default(720)
});
const startVotingSchema = z.object({ confirm: z.boolean().optional().default(false) });
const cancelSchema = z.object({ confirm: z.string().optional() });
const listQuerySchema = z.object({
  filter: z.enum(['All', 'Active', 'Scheduled', 'Past']).optional().default('All'),
  search: z.string().max(200).optional().default('')
});
export class StationController {
  readonly create: RequestHandler = async (request, response) => {
    const input = parseBody(stationCreateSchema, request.body);
    const host = authenticatedHost(response);
    const station = await this.serviceFor(response).createStation(host.id, input);
    response.status(201).json({ station });
  };

  readonly update: RequestHandler = async (request, response) => {
    const input = parseBody(stationUpdateSchema, request.body);
    const station = await this.serviceFor(response).updateStation(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      input
    );
    response.status(200).json({ station });
  };

  readonly createCategory: RequestHandler = async (request, response) => {
    const { title } = parseBody(categorySchema, request.body);
    const category = await this.serviceFor(response).createCategory(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      title
    );
    response.status(201).json({ category });
  };

  readonly renameCategory: RequestHandler = async (request, response) => {
    const { title } = parseBody(categorySchema, request.body);
    const category = await this.serviceFor(response).renameCategory(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'categoryId'),
      title
    );
    response.status(200).json({ category });
  };

  readonly reorderCategories: RequestHandler = async (request, response) => {
    const { categoryIds } = parseBody(reorderSchema, request.body);
    const categories = await this.serviceFor(response).reorderCategories(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      categoryIds
    );
    response.status(200).json({ categories });
  };

  readonly deleteCategory: RequestHandler = async (request, response) => {
    await this.serviceFor(response).deleteCategory(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'categoryId')
    );
    response.status(204).end();
  };

  readonly createCandidate: RequestHandler = async (request, response) => {
    const input = parseBody(candidateSchema, request.body);
    const candidate = await this.serviceFor(response).createCandidate(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'categoryId'),
      input
    );
    response.status(201).json({ candidate });
  };

  readonly editCandidate: RequestHandler = async (request, response) => {
    const input = parseBody(candidateUpdateSchema, request.body);
    const candidate = await this.serviceFor(response).editCandidate(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'candidateId'),
      input
    );
    response.status(200).json({ candidate });
  };

  readonly deleteCandidate: RequestHandler = async (request, response) => {
    await this.serviceFor(response).deleteCandidate(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      param(request, 'candidateId')
    );
    response.status(204).end();
  };

  readonly signUpload: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).signUpload(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json(result);
  };

  readonly registrationConfig: RequestHandler = async (request, response) => {
    const input = parseBody(registrationConfigSchema, request.body);
    const result = await this.serviceFor(response).setRegistrationConfig(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      input.voterCap,
      input.durationHours
    );
    response.status(200).json({
      station: result.station,
      ...(result.warningKey ? { warningKey: result.warningKey } : {})
    });
  };

  readonly votingConfig: RequestHandler = async (request, response) => {
    const input = parseBody(votingConfigSchema, request.body);
    if (input.startMode === 'SCHEDULED' && !input.startsAt) {
      throw new ValidationError({ reason: 'errors.station.scheduled_start_invalid' });
    }
    const station = await this.serviceFor(response).setVotingConfig(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      {
        startMode: input.startMode,
        ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }),
        durationMinutes: input.durationMinutes
      }
    );
    response.status(200).json({ station });
  };

  readonly launch: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).launch(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json(result);
  };

  readonly extendRegistration: RequestHandler = async (request, response) => {
    const { additionalHours } = parseBody(
      z.object({ additionalHours: z.number().int() }),
      request.body
    );
    const station = await this.serviceFor(response).extendRegistration(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      additionalHours
    );
    response.status(200).json({ station });
  };

  readonly voterCap: RequestHandler = async (request, response) => {
    const { voterCap } = parseBody(z.object({ voterCap: z.number().int() }), request.body);
    const result = await this.serviceFor(response).updateVoterCap(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      voterCap
    );
    response.status(200).json({
      station: result.station,
      ...(result.warningKey ? { warningKey: result.warningKey } : {})
    });
  };

  readonly startVoting: RequestHandler = async (request, response) => {
    const { confirm } = parseBody(startVotingSchema, request.body ?? {});
    const result = await this.serviceFor(response).startVoting(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      confirm
    );
    response.status(200).json(result);
  };

  readonly cancel: RequestHandler = async (request, response) => {
    const { confirm } = parseBody(cancelSchema, request.body ?? {});
    const station = await this.serviceFor(response).cancel(
      authenticatedHost(response).id,
      param(request, 'stationId'),
      confirm
    );
    response.status(200).json({ station });
  };

  readonly list: RequestHandler = async (request, response) => {
    const { filter, search } = parseBody(listQuerySchema, request.query);
    const stations = await this.serviceFor(response).list(
      authenticatedHost(response).id,
      filter,
      search
    );
    response.status(200).json({ stations });
  };

  readonly detail: RequestHandler = async (request, response) => {
    const station = await this.serviceFor(response).detail(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json({ station });
  };

  readonly activity: RequestHandler = async (request, response) => {
    const activity = await this.serviceFor(response).activity(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json({ activity });
  };

  readonly publicDetail: RequestHandler = async (request, response) => {
    const station = await this.serviceFor(response).publicStation(param(request, 'publicId'));
    response.status(200).json({ station });
  };

  private serviceFor(response: Response): StationService {
    const service = response.locals.stationService as StationService | undefined;
    if (!service) {
      throw new AppError('errors.station.not_configured', 503);
    }
    return service;
  }
}

function authenticatedHost(response: Response) {
  const host = response.locals.authenticatedHost?.host;
  if (!host) {
    throw new UnauthorizedError();
  }
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
    throw new ValidationError({ reason: MESSAGE_KEYS.errors.validation });
  }
  return result.data;
}
