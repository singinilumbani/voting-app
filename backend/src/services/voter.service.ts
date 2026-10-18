import type { AppConfig } from '../config/env.js';
import { AppError, NotFoundError } from '../core/app-error.js';
import {
  hashFingerprint,
  hashIp,
  hashToken,
  generateVoterToken,
  normalizePhone,
  normalizeTokenInput
} from '../shared/index.js';
import type { RateLimiter } from './rate-limiter.js';
import type {
  VoterCounts,
  VoterRecord,
  VoterRepositoryPort,
  VoterStationRecord
} from './voter.repository.js';

const ATTEMPT_LIMIT = 3;
const phoneErrorKeys = {
  TOO_SHORT: 'errors.phone.too_short',
  TOO_LONG: 'errors.phone.too_long',
  NOT_MOBILE: 'errors.phone.not_mobile',
  SPREADSHEET_DAMAGED: 'errors.phone.spreadsheet_damaged',
  EMPTY: 'errors.phone.empty',
  INVALID_CHARACTERS: 'errors.phone.invalid_characters'
} as const;

export interface VoterServiceDependencies {
  config: Pick<AppConfig, 'tokenHmacSecret'>;
  registrationRateLimiter: RateLimiter;
  statusRateLimiter: RateLimiter;
  now?: () => Date;
  tokenGenerator?: () => string;
}

export interface RegistrationInput {
  fullName: string;
  phone: string;
  deviceUuid: string;
  fingerprintHash: string;
  ip: string;
}

export interface VoterListOptions {
  search: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOTED' | 'REVOKED';
  page: number;
  pageSize: number;
}

export interface VoterQueueDto {
  id: string;
  fullName: string;
  phone: string;
  whatsappUrl: string | null;
  status: VoterRecord['approvalStatus'] | 'VOTED';
  rejectionReason: string | null;
  blocked: boolean;
  registeredAt: Date;
  approvedAt: Date | null;
  hasVoted: boolean;
  deviceFlag: string | null;
}

export class VoterService {
  private readonly now: () => Date;
  private readonly tokenGenerator: () => string;

  constructor(
    private readonly repository: VoterRepositoryPort,
    private readonly dependencies: VoterServiceDependencies
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.tokenGenerator = dependencies.tokenGenerator ?? generateVoterToken;
  }

  async register(publicId: string, input: RegistrationInput) {
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone.ok) {
      throw new AppError(phoneErrorKeys[normalizedPhone.reason], 400);
    }
    const secret = this.secret();
    const ipHash = await hashIp(secret, input.ip);
    if (!this.dependencies.registrationRateLimiter.consume(`register:ip:${ipHash}`)) {
      throw new AppError('errors.registration.rate_limited', 429);
    }
    const phoneRateKey = await hashToken(secret, publicId, normalizedPhone.canonical);
    if (!this.dependencies.registrationRateLimiter.consume(`register:phone:${phoneRateKey}`)) {
      throw new AppError('errors.registration.rate_limited', 429);
    }

    return this.repository.withTransaction(async (repository) => {
      const station = await repository.findPublicStation(publicId, true);
      if (!station) {
        throw new NotFoundError('errors.station.not_found');
      }
      this.requireRegistrationOpen(station);
      const existing = await repository.findByPhone(station.id, normalizedPhone.canonical, true);
      if (existing?.blocked) {
        throw new AppError('errors.registration.blocked', 403);
      }
      if (existing && existing.approvalStatus !== 'REJECTED') {
        throw new AppError('errors.registration.already_registered', 409);
      }
      if (existing && existing.registrationAttempts >= ATTEMPT_LIMIT) {
        throw new AppError('errors.registration.attempts_exceeded', 409);
      }
      const capacityCount = await repository.countCapacityRegistrations(station.id);
      if (capacityCount >= station.voterCap) {
        throw new AppError('errors.registration.full', 409);
      }

      const token = this.tokenGenerator();
      const normalizedToken = normalizeTokenInput(token);
      if (!normalizedToken.ok) {
        throw new AppError('errors.registration.token_generation_failed', 500);
      }
      const tokenHash = await hashToken(secret, station.id, normalizedToken.normalized);
      const fingerprintHash = await hashFingerprint(secret, input.fingerprintHash);
      const now = this.now();
      const values = {
        fullName: input.fullName.trim(),
        phoneNumber: normalizedPhone.canonical,
        approvalStatus: 'PENDING' as const,
        rejectionReason: null,
        registrationAttempts: (existing?.registrationAttempts ?? 0) + 1,
        blocked: false,
        tokenHash,
        failedAttempts: 0,
        lockedUntil: null,
        deviceFingerprintHash: fingerprintHash,
        clientDeviceUuid: input.deviceUuid,
        ipHash,
        flagReason: null,
        hasVoted: false,
        votedAt: null,
        registeredAt: now,
        approvedAt: null
      };
      const voter = existing
        ? await repository.updateVoter(existing.id, values)
        : await repository.createVoter({ pollingStationId: station.id, ...values });
      if (!voter) {
        throw new AppError('errors.registration.create_failed', 500);
      }
      return { token, status: voter.approvalStatus };
    });
  }

  async status(publicId: string, token: string, ip: string) {
    const secret = this.secret();
    const ipHash = await hashIp(secret, ip);
    if (!this.dependencies.statusRateLimiter.consume(`status:ip:${ipHash}`)) {
      throw new AppError('errors.registration.rate_limited', 429);
    }
    const station = await this.repository.findPublicStation(publicId);
    if (!station) {
      throw new NotFoundError('errors.station.not_found');
    }
    const normalizedToken = normalizeTokenInput(token);
    if (!normalizedToken.ok) {
      throw new AppError(
        normalizedToken.reason === 'INVALID_LENGTH'
          ? 'errors.token.invalid_length'
          : 'errors.token.invalid_characters',
        400
      );
    }
    const tokenHash = await hashToken(secret, station.id, normalizedToken.normalized);
    const voter = await this.repository.findByTokenHash(station.id, tokenHash);
    if (!voter) {
      throw new NotFoundError('errors.registration.not_found');
    }
    return {
      status: voter.approvalStatus,
      ...(voter.approvalStatus === 'REJECTED' && voter.rejectionReason
        ? { rejectionReason: voter.rejectionReason }
        : {})
    };
  }

  async list(
    hostId: string,
    stationId: string,
    options: VoterListOptions
  ): Promise<{
    voters: VoterQueueDto[];
    counts: VoterCounts & { cap: number };
    total: number;
    page: number;
    pageSize: number;
  }> {
    const station = await this.requireOwnedStation(hostId, stationId);
    const allVoters = await this.repository.listVoters(stationId);
    const search = options.search.trim().toLocaleLowerCase();
    const searchDigits = search.replace(/\D/gu, '');
    const normalizedSearchPhone = search ? normalizePhone(options.search) : undefined;
    const matched = allVoters.filter((voter) => {
      const phone = normalizePhone(voter.phoneNumber);
      const matchesSearch =
        !search ||
        voter.fullName.toLocaleLowerCase().includes(search) ||
        (searchDigits.length > 0 && voter.phoneNumber.includes(searchDigits)) ||
        (normalizedSearchPhone?.ok && voter.phoneNumber === normalizedSearchPhone.canonical) ||
        (phone.ok && phone.display.toLocaleLowerCase().includes(search));
      const matchesStatus =
        !options.status ||
        (options.status === 'VOTED' ? voter.hasVoted : voter.approvalStatus === options.status);
      return matchesSearch && matchesStatus;
    });
    const start = (options.page - 1) * options.pageSize;
    const selected = matched.slice(start, start + options.pageSize);
    const voters: VoterQueueDto[] = selected.map((voter): VoterQueueDto => {
      const normalized = normalizePhone(voter.phoneNumber);
      const display = phonePresentation(voter.phoneNumber);
      const sameDeviceCount = allVoters.filter(
        (other) =>
          other.id !== voter.id &&
          ((voter.clientDeviceUuid !== null && other.clientDeviceUuid === voter.clientDeviceUuid) ||
            (voter.deviceFingerprintHash !== null &&
              other.deviceFingerprintHash === voter.deviceFingerprintHash))
      ).length;
      return {
        id: voter.id,
        fullName: voter.fullName,
        phone: normalized.ok ? normalized.display : display.phone,
        whatsappUrl: normalized.ok ? normalized.whatsappUrl : display.whatsappUrl,
        status: voter.hasVoted ? 'VOTED' : voter.approvalStatus,
        rejectionReason: voter.rejectionReason,
        blocked: voter.blocked,
        registeredAt: voter.registeredAt,
        approvedAt: voter.approvedAt,
        hasVoted: voter.hasVoted,
        deviceFlag: sameDeviceCount > 0 ? `SAME_DEVICE_AS_${sameDeviceCount}` : null
      };
    });
    const counts = await this.repository.countVoters(stationId);
    return {
      voters,
      counts: { ...counts, cap: station.voterCap },
      total: matched.length,
      page: options.page,
      pageSize: options.pageSize
    };
  }

  async approve(hostId: string, stationId: string, voterId: string) {
    return this.changePendingStatus(hostId, stationId, [voterId], 'APPROVED');
  }

  async reject(hostId: string, stationId: string, voterId: string, reason?: string) {
    return this.changePendingStatus(hostId, stationId, [voterId], 'REJECTED', reason);
  }

  async bulkApprove(
    hostId: string,
    stationId: string,
    input: { voterIds?: string[]; allPending?: boolean }
  ) {
    return this.bulkChange(hostId, stationId, input, 'APPROVED');
  }

  async bulkReject(
    hostId: string,
    stationId: string,
    input: { voterIds?: string[]; allPending?: boolean; reason?: string }
  ) {
    return this.bulkChange(hostId, stationId, input, 'REJECTED', input.reason);
  }

  async revoke(hostId: string, stationId: string, voterId: string) {
    return this.repository.withTransaction(async (repository) => {
      const station = await this.requireOwnedStation(hostId, stationId, repository, true);
      if (!['REG_OPEN', 'REG_CLOSED', 'VOTE_OPEN'].includes(station.status)) {
        throw new AppError('errors.voter.action_locked', 409);
      }
      const voter = await repository.findVoter(stationId, voterId, true);
      if (!voter) {
        throw new NotFoundError('errors.voter.not_found');
      }
      if (voter.approvalStatus !== 'APPROVED' || voter.hasVoted) {
        throw new AppError('errors.voter.revoke_not_allowed', 409);
      }
      const updated = await repository.updateVoter(voterId, { approvalStatus: 'REVOKED' });
      await this.logAction(repository, stationId, hostId, 'VOTER_REVOKED');
      return updated;
    });
  }

  async reissueToken(hostId: string, stationId: string, voterId: string) {
    const secret = this.secret();
    return this.repository.withTransaction(async (repository) => {
      const station = await this.requireOwnedStation(hostId, stationId, repository, true);
      if (!['REG_OPEN', 'REG_CLOSED', 'VOTE_OPEN'].includes(station.status)) {
        throw new AppError('errors.voter.action_locked', 409);
      }
      const voter = await repository.findVoter(stationId, voterId, true);
      if (!voter) {
        throw new NotFoundError('errors.voter.not_found');
      }
      if (!['PENDING', 'APPROVED'].includes(voter.approvalStatus) || voter.hasVoted) {
        throw new AppError('errors.voter.reissue_not_allowed', 409);
      }
      const token = this.tokenGenerator();
      const normalizedToken = normalizeTokenInput(token);
      if (!normalizedToken.ok) {
        throw new AppError('errors.registration.token_generation_failed', 500);
      }
      const tokenHash = await hashToken(secret, stationId, normalizedToken.normalized);
      await repository.updateVoter(voterId, {
        tokenHash,
        failedAttempts: 0,
        lockedUntil: null
      });
      await this.logAction(repository, stationId, hostId, 'TOKEN_REISSUED');
      return { token };
    });
  }

  async blockNumber(hostId: string, stationId: string, voterId: string) {
    return this.repository.withTransaction(async (repository) => {
      await this.requireOwnedStation(hostId, stationId, repository, true);
      const voter = await repository.findVoter(stationId, voterId, true);
      if (!voter) {
        throw new NotFoundError('errors.voter.not_found');
      }
      await repository.updateVoter(voterId, { blocked: true });
      await this.logAction(repository, stationId, hostId, 'VOTER_BLOCKED');
    });
  }

  async integrity(hostId: string, stationId: string) {
    await this.requireOwnedStation(hostId, stationId);
    const integrity = await this.repository.voterIntegrity(stationId);
    return {
      ...integrity,
      alert: integrity.ballotsCast > integrity.approvedVoters
    };
  }

  async exportCsv(hostId: string, stationId: string): Promise<string> {
    await this.requireOwnedStation(hostId, stationId);
    const voters = await this.repository.listVoters(stationId);
    const rows = [
      ['full_name', 'phone_number', 'status'],
      ...voters.map((voter) => [
        voter.fullName,
        phonePresentation(voter.phoneNumber).phone,
        voter.hasVoted ? 'VOTED' : voter.approvalStatus
      ])
    ];
    return rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  }

  private async changePendingStatus(
    hostId: string,
    stationId: string,
    voterIds: string[],
    status: 'APPROVED' | 'REJECTED',
    reason?: string
  ) {
    return this.repository.withTransaction(async (repository) => {
      const station = await this.requireOwnedStation(hostId, stationId, repository, true);
      this.requireApprovalOpen(station);
      const voter = await repository.findVoter(stationId, voterIds[0] ?? '', true);
      if (!voter) {
        throw new NotFoundError('errors.voter.not_found');
      }
      if (voter.approvalStatus !== 'PENDING') {
        throw new AppError('errors.voter.not_pending', 409);
      }
      const updated = await repository.updateVoter(voter.id, {
        approvalStatus: status,
        rejectionReason: status === 'REJECTED' ? reason?.trim() || null : null,
        approvedAt: status === 'APPROVED' ? this.now() : null
      });
      await this.logAction(
        repository,
        stationId,
        hostId,
        status === 'APPROVED' ? 'VOTER_APPROVED' : 'VOTER_REJECTED'
      );
      return updated;
    });
  }

  private async bulkChange(
    hostId: string,
    stationId: string,
    input: { voterIds?: string[]; allPending?: boolean },
    status: 'APPROVED' | 'REJECTED',
    reason?: string
  ) {
    return this.repository.withTransaction(async (repository) => {
      const station = await this.requireOwnedStation(hostId, stationId, repository, true);
      this.requireApprovalOpen(station);
      const voterIds = input.allPending
        ? await repository.listPendingVoterIds(stationId)
        : (input.voterIds ?? []);
      const updated: VoterRecord[] = [];
      for (const voterId of voterIds) {
        const voter = await repository.findVoter(stationId, voterId, true);
        if (!voter) {
          throw new NotFoundError('errors.voter.not_found');
        }
        if (voter.approvalStatus !== 'PENDING') {
          throw new AppError('errors.voter.not_pending', 409);
        }
        const result = await repository.updateVoter(voterId, {
          approvalStatus: status,
          rejectionReason: status === 'REJECTED' ? reason?.trim() || null : null,
          approvedAt: status === 'APPROVED' ? this.now() : null
        });
        if (result) updated.push(result);
        await this.logAction(
          repository,
          stationId,
          hostId,
          status === 'APPROVED' ? 'VOTER_APPROVED' : 'VOTER_REJECTED'
        );
      }
      return { updatedCount: updated.length };
    });
  }

  private async requireOwnedStation(
    hostId: string,
    stationId: string,
    repository = this.repository,
    forUpdate = false
  ): Promise<VoterStationRecord> {
    const station = await repository.findOwnedStation(hostId, stationId, forUpdate);
    if (!station) {
      throw new NotFoundError('errors.station.not_found');
    }
    return station;
  }

  private requireRegistrationOpen(station: VoterStationRecord) {
    if (station.mode !== 'CLOSED_VOTE' || station.status !== 'REG_OPEN') {
      throw new AppError('errors.registration.closed', 409);
    }
  }

  private requireApprovalOpen(station: VoterStationRecord) {
    if (!['REG_OPEN', 'REG_CLOSED'].includes(station.status)) {
      throw new AppError('errors.voter.approval_locked', 409);
    }
  }

  private async logAction(
    repository: VoterRepositoryPort,
    stationId: string,
    actorUserId: string,
    eventType:
      'VOTER_APPROVED' | 'VOTER_REJECTED' | 'VOTER_REVOKED' | 'TOKEN_REISSUED' | 'VOTER_BLOCKED'
  ) {
    await repository.addActivity({ pollingStationId: stationId, actorUserId, eventType });
  }

  private secret(): string {
    const secret = this.dependencies.config.tokenHmacSecret;
    if (!secret) {
      throw new AppError('errors.registration.not_configured', 503);
    }
    return secret;
  }
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function phonePresentation(phoneNumber: string): { phone: string; whatsappUrl: string | null } {
  if (/^\d{8,15}$/u.test(phoneNumber) && !phoneNumber.startsWith('265')) {
    return {
      phone: `+${phoneNumber}`,
      whatsappUrl: `https://wa.me/${phoneNumber}`
    };
  }
  return { phone: phoneNumber, whatsappUrl: null };
}
