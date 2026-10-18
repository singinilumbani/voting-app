import type { AppConfig } from '../config/env.js';
import { AppError, NotFoundError } from '../core/app-error.js';
import {
  base64urlDecode,
  base64urlEncode,
  constantTimeEqual,
  hashFingerprint,
  hashToken,
  hmacHex,
  normalizePhone,
  normalizeTokenInput
} from '../shared/index.js';
import type { RateLimiter } from './rate-limiter.js';
import type {
  VotingCandidate,
  VotingCategory,
  VotingRepositoryPort,
  VotingStation,
  VotingVoter
} from './voting.repository.js';

export interface VotingSelection {
  categoryId: string;
  candidateId: string | 'ABSTAIN';
}

export interface VotingServiceDependencies {
  config: Pick<AppConfig, 'tokenHmacSecret' | 'sessionSecret' | 'publicPollBallotCeiling'>;
  ipRateLimiter: RateLimiter;
  phoneRateLimiter: RateLimiter;
  now?: () => Date;
}

type SelectedVote = { categoryId: string; candidateId: string | null };

export class VotingService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: VotingRepositoryPort,
    private readonly dependencies: VotingServiceDependencies
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async enter(publicId: string, token: string, phone: string | undefined, ip: string) {
    const ipKey = await hmacHex(this.tokenSecret(), `vote-entry-ip:${ip}`);
    if (!(await this.dependencies.ipRateLimiter.consume(`vote:enter:ip:${ipKey}`))) {
      throw new AppError('errors.vote.rate_limited', 429);
    }
    const station = await this.requireStation(publicId);
    this.requireModeAndOpen(station, 'CLOSED_VOTE');
    let normalizedPhone: string | undefined;
    if (phone !== undefined) {
      const normalized = normalizePhone(phone);
      if (!normalized.ok) {
        const phoneErrorKeys = {
          TOO_SHORT: 'errors.phone.too_short',
          TOO_LONG: 'errors.phone.too_long',
          NOT_MOBILE: 'errors.phone.not_mobile',
          SPREADSHEET_DAMAGED: 'errors.phone.spreadsheet_damaged',
          EMPTY: 'errors.phone.empty',
          INVALID_CHARACTERS: 'errors.phone.invalid_characters'
        } as const;
        throw new AppError(phoneErrorKeys[normalized.reason], 400);
      }
      normalizedPhone = normalized.canonical;
    }
    const normalizedToken = normalizeTokenInput(token);
    if (!normalizedToken.ok) {
      if (normalizedPhone) {
        const voter = await this.repository.findVoterByPhone(station.id, normalizedPhone);
        if (voter) {
          if (await this.recordWrongPhoneAttempt(station.id, voter)) {
            throw new AppError('errors.vote.token_locked', 423);
          }
        }
      }
      throw new AppError('errors.vote.invalid_token', 401);
    }
    const candidateHash = await hashToken(
      this.tokenSecret(),
      station.id,
      normalizedToken.normalized
    );

    let voter: VotingVoter | undefined;
    if (normalizedPhone !== undefined) {
      const [tokenVoter, phoneVoter] = await Promise.all([
        this.repository.findVoterByTokenHash(station.id, candidateHash),
        this.repository.findVoterByPhone(station.id, normalizedPhone)
      ]);
      const expectedHash = phoneVoter?.tokenHash ?? '0'.repeat(64);
      const hashMatches = constantTimeEqual(expectedHash, candidateHash);
      const sameVoter = tokenVoter && phoneVoter && tokenVoter.id === phoneVoter.id;
      if (!phoneVoter || !hashMatches || !sameVoter) {
        if (await this.recordWrongPhoneAttempt(station.id, phoneVoter)) {
          throw new AppError('errors.vote.token_locked', 423);
        }
        throw new AppError('errors.vote.invalid_token', 401);
      }
      voter = phoneVoter;
    } else {
      voter = await this.repository.findVoterByTokenHash(station.id, candidateHash);
      if (!voter || !constantTimeEqual(voter.tokenHash ?? '0'.repeat(64), candidateHash)) {
        throw new AppError('errors.vote.invalid_token', 401);
      }
    }

    if (voter.lockedUntil && voter.lockedUntil.getTime() > this.now().getTime()) {
      throw new AppError('errors.vote.token_locked', 423);
    }
    if (voter.hasVoted) {
      return {
        alreadyVoted: true as const,
        ...(station.resultsVisibility === 'IMMEDIATE'
          ? { resultsAccessToken: await this.resultsToken(station.id, 'closed-vote', voter.id) }
          : {})
      };
    }
    if (voter.approvalStatus !== 'APPROVED' || voter.blocked) {
      throw new AppError('errors.vote.not_approved', 403);
    }
    if (voter.failedAttempts > 0 || voter.lockedUntil !== null) {
      await this.repository.updateVoter(voter.id, { failedAttempts: 0, lockedUntil: null });
    }

    const categories = await this.repository.listCategories(station.id);
    const candidates = await this.repository.listCandidates(station.id);
    const expiresAt = Math.min(
      station.voteEndsAt?.getTime() ?? Number.POSITIVE_INFINITY,
      this.now().getTime() + 2 * 60 * 60 * 1000
    );
    return {
      alreadyVoted: false as const,
      ballotSession: await this.signPayload({
        type: 'ballot',
        stationId: station.id,
        voterId: voter.id,
        expiresAt
      }),
      expiresAt: new Date(expiresAt),
      ballot: this.ballot(categories, candidates)
    };
  }

  async submitClosed(
    publicId: string,
    ballotSession: string,
    selections: VotingSelection[],
    ip = 'unknown'
  ) {
    await this.rateLimitSubmitIp(ip);
    const payload = await this.verifyPayload(ballotSession, 'ballot');
    const station = await this.requireStation(publicId);
    this.requireModeAndOpen(station, 'CLOSED_VOTE');
    if (payload.stationId !== station.id || typeof payload.voterId !== 'string') {
      throw new AppError('errors.vote.session_invalid', 401);
    }
    const voterId = payload.voterId;
    const phoneLimitKey = await hmacHex(
      this.tokenSecret(),
      `vote-submit-voter:${station.id}:${voterId}`
    );
    if (!(await this.dependencies.phoneRateLimiter.consume(`vote:submit:phone:${phoneLimitKey}`))) {
      throw new AppError('errors.vote.rate_limited', 429);
    }
    const alreadyVoted = await this.repository.withTransaction(async (repository) => {
      const lockedStation = await repository.findStation(publicId, true);
      if (!lockedStation || lockedStation.id !== station.id) {
        throw new NotFoundError('errors.station.not_found');
      }
      this.requireModeAndOpen(lockedStation, 'CLOSED_VOTE');
      const voter = await repository.findVoter(station.id, voterId, true);
      if (!voter || voter.approvalStatus !== 'APPROVED' || voter.blocked) {
        throw new AppError('errors.vote.not_approved', 403);
      }
      if (voter.hasVoted) return true;
      const categories = await repository.listCategories(station.id);
      const candidates = await repository.listCandidates(station.id);
      const normalized = this.validateSelections(station, categories, candidates, selections);
      await repository.insertVotes(station.id, normalized);
      const votedAt = new Date(this.now());
      votedAt.setUTCSeconds(0, 0);
      const updated = await repository.updateVoter(voter.id, { hasVoted: true, votedAt });
      if (!updated) throw new AppError('errors.vote.not_configured', 500);
      return false;
    });
    if (alreadyVoted) {
      return {
        alreadyVoted: true as const,
        ...(station.resultsVisibility === 'IMMEDIATE'
          ? { resultsAccessToken: await this.resultsToken(station.id, 'closed-vote', voterId) }
          : {})
      };
    }
    return {
      alreadyVoted: false as const,
      confirmation: 'status.vote.submitted',
      ...(station.resultsVisibility === 'IMMEDIATE'
        ? { resultsAccessToken: await this.resultsToken(station.id, 'closed-vote', voterId) }
        : {})
    };
  }

  async submitPublic(
    publicId: string,
    selections: VotingSelection[],
    deviceUuid: string,
    fingerprintHash: string,
    ip = 'unknown'
  ) {
    await this.rateLimitSubmitIp(ip);
    const station = await this.requireStation(publicId);
    this.requireModeAndOpen(station, 'PUBLIC_POLL');
    const fingerprint = await hashFingerprint(this.tokenSecret(), fingerprintHash);
    await this.repository.withTransaction(async (repository) => {
      const lockedStation = await repository.findStation(publicId, true);
      if (!lockedStation || lockedStation.id !== station.id) {
        throw new NotFoundError('errors.station.not_found');
      }
      this.requireModeAndOpen(lockedStation, 'PUBLIC_POLL');
      const device = await repository.findDevice(station.id, deviceUuid, true);
      if (device?.hasVoted) throw new AppError('errors.vote.duplicate_device', 409);
      if (
        (await repository.countVotedDevices(station.id)) >=
        this.dependencies.config.publicPollBallotCeiling
      ) {
        throw new AppError('errors.vote.capacity_reached', 409);
      }
      const categories = await repository.listCategories(station.id);
      const candidates = await repository.listCandidates(station.id);
      const normalized = this.validateSelections(station, categories, candidates, selections);
      if (device) {
        const updatedDevice = await repository.updateDevice(device.id, {
          deviceFingerprintHash: fingerprint,
          hasVoted: true
        });
        if (!updatedDevice) throw new AppError('errors.vote.not_configured', 500);
      } else {
        const createdDevice = await repository.insertDevice({
          pollingStationId: station.id,
          clientDeviceUuid: deviceUuid,
          deviceFingerprintHash: fingerprint,
          hasVoted: true
        });
        if (!createdDevice) throw new AppError('errors.vote.not_configured', 500);
      }
      await repository.insertVotes(station.id, normalized);
    });
    return {
      confirmation: 'status.vote.submitted',
      ...(station.resultsVisibility === 'IMMEDIATE'
        ? {
            resultsAccessToken: await this.resultsToken(station.id, 'public-poll', deviceUuid)
          }
        : {})
    };
  }

  async results(publicId: string, accessToken: string | undefined) {
    const station = await this.requireStation(publicId);
    if (!['VOTE_OPEN', 'VOTE_CLOSED', 'ARCHIVED'].includes(station.status)) {
      throw new AppError('errors.vote.results_not_available', 409);
    }
    let authorized =
      station.resultsVisibility === 'CONCEALED' &&
      ['VOTE_CLOSED', 'ARCHIVED'].includes(station.status);
    if (!authorized && station.resultsVisibility === 'IMMEDIATE' && accessToken) {
      const payload = await this.verifyPayload(accessToken, 'results');
      if (payload.stationId === station.id && typeof payload.subject === 'string') {
        if (station.mode === 'CLOSED_VOTE' && payload.audience === 'closed-vote') {
          const voter = await this.repository.findVoter(station.id, payload.subject);
          authorized = voter?.hasVoted === true;
        } else if (station.mode === 'PUBLIC_POLL' && payload.audience === 'public-poll') {
          const device = await this.repository.findDevice(station.id, payload.subject);
          authorized = device?.hasVoted === true;
        }
      }
    }
    if (!authorized) {
      throw new AppError('errors.vote.results_access_required', 403);
    }
    const [categories, candidates, resultRows] = await Promise.all([
      this.repository.listCategories(station.id),
      this.repository.listCandidates(station.id),
      this.repository.listResults(station.id)
    ]);
    const counts = new Map(
      resultRows.map((row) => [`${row.categoryId}:${row.candidateId ?? 'ABSTAIN'}`, row.count])
    );
    return this.ballot(categories, candidates).map((category) => ({
      ...category,
      results: [
        ...category.candidates.map((candidate) => ({
          candidateId: candidate.id,
          count: counts.get(`${category.id}:${candidate.id}`) ?? 0
        })),
        {
          candidateId: 'ABSTAIN' as const,
          count: counts.get(`${category.id}:ABSTAIN`) ?? 0
        }
      ]
    }));
  }

  private async recordWrongPhoneAttempt(
    stationId: string,
    voter: VotingVoter | undefined
  ): Promise<boolean> {
    if (!voter) return false;
    return this.repository.withTransaction(async (repository) => {
      const current = await repository.findVoter(stationId, voter.id, true);
      if (!current) return false;
      const now = this.now();
      if (current.lockedUntil && current.lockedUntil.getTime() > now.getTime()) {
        throw new AppError('errors.vote.token_locked', 423);
      }
      const failedAttempts = current.failedAttempts + 1;
      await repository.updateVoter(current.id, {
        failedAttempts,
        ...(failedAttempts >= 5 ? { lockedUntil: new Date(now.getTime() + 15 * 60 * 1000) } : {}),
        ...(failedAttempts >= 10 ? { flagReason: 'flags.voter.token_attempts_exceeded' } : {})
      });
      return failedAttempts >= 5;
    });
  }

  async rateLimitSubmitIp(ip: string): Promise<void> {
    const ipKey = await hmacHex(this.tokenSecret(), `vote-submit-ip:${ip}`);
    if (!(await this.dependencies.ipRateLimiter.consume(`vote:submit:ip:${ipKey}`))) {
      throw new AppError('errors.vote.rate_limited', 429);
    }
  }

  private validateSelections(
    station: VotingStation,
    categories: VotingCategory[],
    candidates: VotingCandidate[],
    selections: VotingSelection[]
  ): SelectedVote[] {
    if (selections.length !== categories.length) {
      throw new AppError('errors.vote.partial_ballot', 400);
    }
    const categoryIds = new Set(categories.map(({ id }) => id));
    const candidateMap = new Map(
      candidates.map((candidate) => [candidate.id, candidate.categoryId])
    );
    const seen = new Set<string>();
    return selections.map((selection) => {
      if (!categoryIds.has(selection.categoryId) || seen.has(selection.categoryId)) {
        throw new AppError('errors.vote.invalid_selection', 400);
      }
      seen.add(selection.categoryId);
      if (selection.candidateId === 'ABSTAIN') {
        if (!station.allowAbstain) throw new AppError('errors.vote.abstain_not_allowed', 400);
        return { categoryId: selection.categoryId, candidateId: null };
      }
      if (candidateMap.get(selection.candidateId) !== selection.categoryId) {
        throw new AppError('errors.vote.invalid_selection', 400);
      }
      return { categoryId: selection.categoryId, candidateId: selection.candidateId };
    });
  }

  private ballot(categories: VotingCategory[], candidates: VotingCandidate[]) {
    return categories.map((category) => ({
      id: category.id,
      title: category.title,
      candidates: candidates
        .filter((candidate) => candidate.categoryId === category.id)
        .map(({ id, name, cloudinaryImageUrl }) => ({ id, name, imageUrl: cloudinaryImageUrl }))
    }));
  }

  private async requireStation(publicId: string): Promise<VotingStation> {
    const station = await this.repository.findStation(publicId);
    if (!station) throw new NotFoundError('errors.station.not_found');
    return station;
  }

  private requireModeAndOpen(station: VotingStation, mode: VotingStation['mode']) {
    if (station.mode !== mode) throw new AppError('errors.vote.wrong_mode', 409);
    const now = this.now().getTime();
    if (!station.voteStartsAt || !station.voteEndsAt) {
      throw new AppError('errors.vote.not_configured', 409);
    }
    if (
      station.status !== 'VOTE_OPEN' ||
      station.voteStartsAt.getTime() > now ||
      station.voteEndsAt.getTime() <= now
    ) {
      throw new AppError('errors.vote.not_open', 409);
    }
  }

  private async signPayload(payload: Record<string, string | number>) {
    const encoded = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    return `${encoded}.${await hmacHex(this.sessionSecret(), encoded)}`;
  }

  private async verifyPayload(token: string, expectedType: string) {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra !== undefined) {
      throw new AppError('errors.vote.session_invalid', 401);
    }
    const actual = await hmacHex(this.sessionSecret(), encoded);
    if (!constantTimeEqual(actual, signature)) {
      throw new AppError('errors.vote.session_invalid', 401);
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encoded))) as Record<
        string,
        unknown
      >;
    } catch {
      throw new AppError('errors.vote.session_invalid', 401);
    }
    if (payload.type !== expectedType) throw new AppError('errors.vote.session_invalid', 401);
    if (typeof payload.expiresAt === 'number' && payload.expiresAt <= this.now().getTime()) {
      throw new AppError('errors.vote.session_expired', 401);
    }
    return payload;
  }

  private async resultsToken(
    stationId: string,
    audience: 'closed-vote' | 'public-poll',
    subject: string
  ) {
    return this.signPayload({ type: 'results', stationId, audience, subject });
  }

  private tokenSecret() {
    const secret = this.dependencies.config.tokenHmacSecret;
    if (!secret) throw new AppError('errors.vote.not_configured', 503);
    return secret;
  }

  private sessionSecret() {
    const secret = this.dependencies.config.sessionSecret;
    if (!secret) throw new AppError('errors.vote.not_configured', 503);
    return secret;
  }
}
