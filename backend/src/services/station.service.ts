import type { AppConfig } from '../config/env.js';
import { AppError, NotFoundError, ValidationError } from '../core/app-error.js';
import { PUBLIC_POLL, REGISTRATION_WINDOW, VOTER_CAP, VOTING_WINDOW } from '../shared/constants.js';
import { StationLifecycle, type StationMode, type StationStatus } from './station-lifecycle.js';
import type { StationRepositoryPort, StationRecord } from './station.repository.js';

const FREE_TIER_WARNING = 'warnings.station.free_tier_voter_cap';
const HOUR = 60 * 60 * 1000;

export interface StationServiceDependencies {
  config: Pick<
    AppConfig,
    | 'appBaseUrl'
    | 'cloudinaryApiKey'
    | 'cloudinaryApiSecret'
    | 'cloudinaryCloudName'
    | 'cloudinaryUploadFolder'
  >;
  now?: () => Date;
  randomBytes?: (size: number) => Uint8Array;
}

export class StationService {
  private readonly lifecycle = new StationLifecycle();
  private readonly now: () => Date;
  private readonly randomBytes: (size: number) => Uint8Array;

  constructor(
    private readonly repository: StationRepositoryPort,
    private readonly dependencies: StationServiceDependencies
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.randomBytes =
      dependencies.randomBytes ?? ((size) => crypto.getRandomValues(new Uint8Array(size)));
  }

  async createStation(
    hostId: string,
    input: {
      name: string;
      description?: string | null;
      mode: StationMode;
      resultsVisibility?: 'IMMEDIATE' | 'CONCEALED';
      allowAbstain: boolean;
      mobileOnly: boolean;
    }
  ) {
    const publicId = Array.from(this.randomBytes(16), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    const station = await this.repository.createStation({
      publicId,
      hostId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      mode: input.mode,
      resultsVisibility: input.resultsVisibility ?? 'CONCEALED',
      allowAbstain: input.allowAbstain,
      mobileOnly: input.mobileOnly,
      voterCap: input.mode === 'PUBLIC_POLL' ? PUBLIC_POLL.ballotCeilingDefault : VOTER_CAP.default
    });
    if (!station) {
      throw new AppError('errors.station.create_failed', 500);
    }
    return station;
  }

  async updateStation(
    hostId: string,
    stationId: string,
    input: {
      name?: string;
      description?: string | null;
      resultsVisibility?: 'IMMEDIATE' | 'CONCEALED';
      allowAbstain?: boolean;
      mobileOnly?: boolean;
    }
  ) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT']);
    const updated = await this.repository.updateStation(hostId, stationId, {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.description === undefined
        ? {}
        : { description: input.description?.trim() || null }),
      ...(input.resultsVisibility === undefined
        ? {}
        : { resultsVisibility: input.resultsVisibility }),
      ...(input.allowAbstain === undefined ? {} : { allowAbstain: input.allowAbstain }),
      ...(input.mobileOnly === undefined ? {} : { mobileOnly: input.mobileOnly })
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return updated;
  }

  async createCategory(hostId: string, stationId: string, title: string) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT']);
    const existing = await this.repository.listCategories(stationId);
    const category = await this.repository.createCategory({
      pollingStationId: stationId,
      title: title.trim(),
      displayOrder: existing.length
    });
    if (!category) {
      throw new AppError('errors.station.category_create_failed', 500);
    }
    return category;
  }

  async renameCategory(hostId: string, stationId: string, categoryId: string, title: string) {
    await this.requireDraftCategory(hostId, stationId, categoryId);
    const category = await this.repository.updateCategory(categoryId, { title: title.trim() });
    if (!category) {
      throw new NotFoundError('errors.station.category_not_found');
    }
    return category;
  }

  async reorderCategories(hostId: string, stationId: string, categoryIds: string[]) {
    await this.requireDraft(hostId, stationId);
    const categories = await this.repository.listCategories(stationId);
    if (
      categories.length !== categoryIds.length ||
      new Set(categoryIds).size !== categoryIds.length ||
      categories.some((category) => !categoryIds.includes(category.id))
    ) {
      throw new ValidationError({ reason: 'errors.station.category_order_invalid' });
    }
    return this.repository.withTransaction(async (repository) => {
      for (const [displayOrder, categoryId] of categoryIds.entries()) {
        await repository.updateCategory(categoryId, { displayOrder });
      }
      return repository.listCategories(stationId);
    });
  }

  async deleteCategory(hostId: string, stationId: string, categoryId: string) {
    await this.requireDraftCategory(hostId, stationId, categoryId);
    await this.repository.deleteCategory(categoryId);
  }

  async createCandidate(
    hostId: string,
    stationId: string,
    categoryId: string,
    input: { name: string; picture?: string | null }
  ) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT', 'REG_OPEN']);
    const category = await this.repository.findOwnedCategory(hostId, stationId, categoryId);
    if (!category) {
      throw new NotFoundError('errors.station.category_not_found');
    }
    return this.repository.withTransaction(async (repository) => {
      const candidate = await repository.createCandidate({
        categoryId,
        name: input.name.trim(),
        cloudinaryImageUrl: input.picture ?? null
      });
      if (!candidate) {
        throw new AppError('errors.station.candidate_create_failed', 500);
      }
      await repository.addActivity({
        pollingStationId: stationId,
        actorUserId: hostId,
        eventType: 'CANDIDATE_ADDED'
      });
      return candidate;
    });
  }

  async editCandidate(
    hostId: string,
    stationId: string,
    candidateId: string,
    input: { name?: string; picture?: string | null }
  ) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT', 'REG_OPEN']);
    const existing = await this.repository.findOwnedCandidate(hostId, stationId, candidateId);
    if (!existing) {
      throw new NotFoundError('errors.station.candidate_not_found');
    }
    return this.repository.withTransaction(async (repository) => {
      const candidate = await repository.updateCandidate(candidateId, {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.picture === undefined ? {} : { cloudinaryImageUrl: input.picture }),
        updatedAt: this.now()
      });
      if (!candidate) {
        throw new NotFoundError('errors.station.candidate_not_found');
      }
      await repository.addActivity({
        pollingStationId: stationId,
        actorUserId: hostId,
        eventType: 'CANDIDATE_EDITED'
      });
      return candidate;
    });
  }

  async deleteCandidate(hostId: string, stationId: string, candidateId: string) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT']);
    const existing = await this.repository.findOwnedCandidate(hostId, stationId, candidateId);
    if (!existing) {
      throw new NotFoundError('errors.station.candidate_not_found');
    }
    await this.repository.deleteCandidate(candidateId);
  }

  async signUpload(hostId: string, stationId: string) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT', 'REG_OPEN']);
    const { cloudinaryApiKey, cloudinaryApiSecret, cloudinaryCloudName, cloudinaryUploadFolder } =
      this.dependencies.config;
    if (!cloudinaryApiKey || !cloudinaryApiSecret || !cloudinaryCloudName) {
      throw new AppError('errors.cloudinary.not_configured', 503);
    }
    const timestamp = Math.floor(this.now().getTime() / 1000);
    const signature = await sha1Hex(
      `folder=${cloudinaryUploadFolder}&timestamp=${timestamp}${cloudinaryApiSecret}`
    );
    return {
      cloudName: cloudinaryCloudName,
      apiKey: cloudinaryApiKey,
      timestamp,
      signature,
      folder: cloudinaryUploadFolder
    };
  }

  async setRegistrationConfig(
    hostId: string,
    stationId: string,
    voterCap: number,
    durationHours: number
  ) {
    const station = await this.requireOwned(hostId, stationId);
    if (station.mode !== 'CLOSED_VOTE') {
      throw new AppError('errors.station.registration_config_mode_invalid', 400);
    }
    this.requireStatus(station, ['DRAFT']);
    if (
      !Number.isInteger(voterCap) ||
      voterCap < VOTER_CAP.minimum ||
      voterCap > VOTER_CAP.maximum
    ) {
      throw new ValidationError({ reason: 'errors.station.voter_cap_invalid' });
    }
    if (
      !Number.isInteger(durationHours) ||
      durationHours < REGISTRATION_WINDOW.minimumMilliseconds / HOUR ||
      durationHours > REGISTRATION_WINDOW.maximumMilliseconds / HOUR
    ) {
      throw new ValidationError({ reason: 'errors.station.registration_duration_invalid' });
    }
    const updated = await this.repository.updateStation(hostId, stationId, {
      voterCap,
      registrationDurationHours: durationHours
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return {
      station: updated,
      warningKey: this.voterCapWarning(voterCap)
    };
  }

  async setVotingConfig(
    hostId: string,
    stationId: string,
    input: { startMode: 'NOW' | 'SCHEDULED'; startsAt?: Date; durationMinutes: number }
  ) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT']);
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < VOTING_WINDOW.minimumMilliseconds / 60_000 ||
      input.durationMinutes > VOTING_WINDOW.maximumMilliseconds / 60_000
    ) {
      throw new ValidationError({ reason: 'errors.station.voting_duration_invalid' });
    }
    const now = this.now();
    let voteStartsAt: Date | null = null;
    if (input.startMode === 'SCHEDULED') {
      if (!input.startsAt || input.startsAt <= now) {
        throw new ValidationError({ reason: 'errors.station.scheduled_start_invalid' });
      }
      const latestStart =
        now.getTime() +
        (station.mode === 'CLOSED_VOTE' ? station.registrationDurationHours * HOUR : 0) +
        VOTING_WINDOW.startWithinMilliseconds;
      const earliestStart =
        now.getTime() +
        (station.mode === 'CLOSED_VOTE' ? station.registrationDurationHours * HOUR : 0);
      if (input.startsAt.getTime() < earliestStart || input.startsAt.getTime() > latestStart) {
        throw new ValidationError({ reason: 'errors.station.scheduled_start_invalid' });
      }
      voteStartsAt = input.startsAt;
    }
    const updated = await this.repository.updateStation(hostId, stationId, {
      voteStartsAt,
      voteEndsAt: voteStartsAt
        ? new Date(voteStartsAt.getTime() + input.durationMinutes * 60_000)
        : null,
      votingDurationMinutes: input.durationMinutes
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return updated;
  }

  async launch(hostId: string, stationId: string) {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT']);
    const categories = await this.repository.listCategories(stationId);
    const candidates = await this.repository.listCandidates(stationId);
    if (
      categories.length === 0 ||
      categories.some(
        (category) =>
          candidates.filter((candidate) => candidate.categoryId === category.id).length < 2
      )
    ) {
      throw new ValidationError({ reason: 'errors.station.ballot_incomplete' });
    }
    const now = this.now();
    const voteStartsAt = station.voteStartsAt;
    if (station.mode === 'PUBLIC_POLL') {
      const end = voteStartsAt
        ? station.voteEndsAt
        : new Date(now.getTime() + station.votingDurationMinutes * 60_000);
      const scheduled = Boolean(voteStartsAt && voteStartsAt > now);
      if (
        scheduled &&
        voteStartsAt!.getTime() - now.getTime() > VOTING_WINDOW.startWithinMilliseconds
      ) {
        throw new ValidationError({ reason: 'errors.station.scheduled_start_invalid' });
      }
      const updated = await this.repository.updateStation(hostId, stationId, {
        isLaunched: true,
        status: scheduled ? 'DRAFT' : 'VOTE_OPEN',
        voteStartsAt: voteStartsAt ?? now,
        voteEndsAt: end ?? new Date(now.getTime() + station.votingDurationMinutes * 60_000)
      });
      if (!updated) {
        throw new NotFoundError('errors.station.not_found');
      }
      return this.launchResult(updated);
    }
    const regStartsAt = now;
    const regEndsAt = new Date(now.getTime() + station.registrationDurationHours * HOUR);
    if (
      voteStartsAt &&
      (voteStartsAt < regEndsAt ||
        voteStartsAt.getTime() > regEndsAt.getTime() + VOTING_WINDOW.startWithinMilliseconds)
    ) {
      throw new ValidationError({ reason: 'errors.station.scheduled_start_invalid' });
    }
    const updated = await this.repository.updateStation(hostId, stationId, {
      isLaunched: true,
      status: 'REG_OPEN',
      regStartsAt,
      regEndsAt,
      voteEndsAt: voteStartsAt
        ? new Date(voteStartsAt.getTime() + station.votingDurationMinutes * 60_000)
        : null
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return this.launchResult(updated);
  }

  async extendRegistration(hostId: string, stationId: string, additionalHours: number) {
    const station = await this.requireOwned(hostId, stationId);
    if (station.mode !== 'CLOSED_VOTE' || station.status !== 'REG_OPEN' || !station.regEndsAt) {
      throw new AppError('errors.station.registration_not_open', 409);
    }
    if (
      !Number.isInteger(additionalHours) ||
      additionalHours < 1 ||
      station.registrationDurationHours + additionalHours >
        REGISTRATION_WINDOW.maximumMilliseconds / HOUR
    ) {
      throw new ValidationError({ reason: 'errors.station.registration_duration_invalid' });
    }
    const updated = await this.repository.updateStation(hostId, stationId, {
      registrationDurationHours: station.registrationDurationHours + additionalHours,
      regEndsAt: new Date(station.regEndsAt.getTime() + additionalHours * HOUR)
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return updated;
  }

  async updateVoterCap(hostId: string, stationId: string, voterCap: number) {
    const station = await this.requireOwned(hostId, stationId);
    if (station.mode !== 'CLOSED_VOTE' || station.status !== 'REG_OPEN') {
      throw new AppError('errors.station.voter_cap_locked', 409);
    }
    if (
      !Number.isInteger(voterCap) ||
      voterCap <= station.voterCap ||
      voterCap > VOTER_CAP.maximum
    ) {
      throw new ValidationError({ reason: 'errors.station.voter_cap_invalid' });
    }
    const updated = await this.repository.updateStation(hostId, stationId, { voterCap });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return { station: updated, warningKey: this.voterCapWarning(voterCap) };
  }

  async startVoting(hostId: string, stationId: string, confirm: boolean) {
    const station = await this.requireOwned(hostId, stationId);
    if (station.mode !== 'CLOSED_VOTE' || station.status !== 'REG_CLOSED') {
      throw new AppError('errors.station.registration_not_closed', 409);
    }
    const pendingCount = await this.repository.countPendingVoters(stationId);
    if (!confirm) {
      return {
        requiresConfirmation: true,
        warningKey: 'warnings.station.pending_voters',
        pendingCount
      };
    }
    const now = this.now();
    const voteStartsAt = station.voteStartsAt ?? now;
    const voteEndsAt =
      station.voteEndsAt ??
      new Date(voteStartsAt.getTime() + station.votingDurationMinutes * 60_000);
    if (voteStartsAt < now) {
      throw new ValidationError({ reason: 'errors.station.scheduled_start_invalid' });
    }
    const nextStatus: StationStatus = voteStartsAt > now ? 'REG_CLOSED' : 'VOTE_OPEN';
    const transition = this.lifecycle.transition(
      station.mode,
      station.status,
      nextStatus === 'REG_CLOSED' ? 'VOTE_OPEN' : nextStatus
    );
    if (!transition.ok) {
      throw new AppError('errors.station.invalid_transition', 409);
    }
    const updated = await this.repository.updateStation(hostId, stationId, {
      status: nextStatus,
      voteStartsAt,
      voteEndsAt
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return { requiresConfirmation: false, station: updated, pendingCount };
  }

  async cancel(hostId: string, stationId: string, confirm?: string) {
    const station = await this.requireOwned(hostId, stationId);
    const transition = this.lifecycle.transition(
      station.mode,
      station.status,
      'CANCELLED',
      confirm
    );
    if (!transition.ok) {
      throw new AppError(
        transition.reason === 'confirmation_required'
          ? 'errors.station.cancel_confirmation_required'
          : 'errors.station.invalid_transition',
        409
      );
    }
    const updated = await this.repository.updateStation(hostId, stationId, {
      status: 'CANCELLED',
      closedAt: this.now()
    });
    if (!updated) {
      throw new NotFoundError('errors.station.not_found');
    }
    return updated;
  }

  async list(hostId: string, filter: 'All' | 'Active' | 'Scheduled' | 'Past', search = '') {
    const now = this.now();
    const term = search.trim().toLocaleLowerCase();
    return (await this.repository.listOwnedStations(hostId))
      .filter((station) => !term || station.name.toLocaleLowerCase().includes(term))
      .filter((station) => {
        const scheduled = this.lifecycle.isScheduled(station, now);
        if (filter === 'Scheduled') return scheduled;
        if (filter === 'Active') return ['REG_OPEN', 'VOTE_OPEN'].includes(station.status);
        if (filter === 'Past')
          return ['VOTE_CLOSED', 'ARCHIVED', 'CANCELLED'].includes(station.status);
        return true;
      })
      .map((station) => ({ ...station, scheduled: this.lifecycle.isScheduled(station, now) }));
  }

  async detail(hostId: string, stationId: string) {
    const station = await this.requireOwned(hostId, stationId);
    const categories = await this.repository.listCategories(stationId);
    const candidates = await this.repository.listCandidates(stationId);
    return {
      ...station,
      scheduled: this.lifecycle.isScheduled(station, this.now()),
      categories: categories.map((category) => ({
        ...category,
        candidates: candidates.filter((candidate) => candidate.categoryId === category.id)
      }))
    };
  }

  async activity(hostId: string, stationId: string) {
    await this.requireOwned(hostId, stationId);
    return this.repository.listActivity(hostId, stationId);
  }

  async publicStation(publicId: string) {
    const station = await this.repository.findPublicStation(publicId);
    if (!station) {
      throw new NotFoundError('errors.station.not_found');
    }
    const categories = await this.repository.listCategories(station.id);
    const candidates = await this.repository.listCandidates(station.id);
    const now = this.now();
    const ballotVisible =
      station.status === 'VOTE_OPEN' &&
      (!station.voteStartsAt || station.voteStartsAt <= now) &&
      (!station.voteEndsAt || station.voteEndsAt > now);
    return {
      publicId: station.publicId,
      name: station.name,
      mode: station.mode,
      status: station.status,
      regStartsAt: station.regStartsAt,
      regEndsAt: station.regEndsAt,
      voteStartsAt: station.voteStartsAt,
      voteEndsAt: station.voteEndsAt,
      mobileOnly: station.mobileOnly,
      allowAbstain: station.allowAbstain,
      resultsVisibility: station.resultsVisibility,
      ...(ballotVisible
        ? {
            categories: categories.map((category) => ({
              id: category.id,
              title: category.title,
              displayOrder: category.displayOrder,
              candidates: candidates
                .filter((candidate) => candidate.categoryId === category.id)
                .map(({ id, name, cloudinaryImageUrl }) => ({ id, name, cloudinaryImageUrl }))
            }))
          }
        : {})
    };
  }

  private async requireOwned(hostId: string, stationId: string): Promise<StationRecord> {
    const station = await this.repository.findOwnedStation(hostId, stationId);
    if (!station) {
      throw new NotFoundError('errors.station.not_found');
    }
    return station;
  }

  private async requireDraft(hostId: string, stationId: string): Promise<StationRecord> {
    const station = await this.requireOwned(hostId, stationId);
    this.requireStatus(station, ['DRAFT']);
    return station;
  }

  private async requireDraftCategory(hostId: string, stationId: string, categoryId: string) {
    await this.requireDraft(hostId, stationId);
    const category = await this.repository.findOwnedCategory(hostId, stationId, categoryId);
    if (!category) {
      throw new NotFoundError('errors.station.category_not_found');
    }
    return category;
  }

  private requireStatus(station: StationRecord, allowed: StationStatus[]) {
    if (!allowed.includes(station.status)) {
      throw new AppError('errors.station.locked', 409);
    }
  }

  private voterCapWarning(voterCap: number) {
    return voterCap > VOTER_CAP.recommendedFreeTierLimit ? FREE_TIER_WARNING : undefined;
  }

  private launchResult(station: StationRecord) {
    const url = new URL(
      `/station/${station.publicId}`,
      this.dependencies.config.appBaseUrl
    ).toString();
    return {
      station,
      publicId: station.publicId,
      shareLink: url,
      ...(this.voterCapWarning(station.voterCap) ? { warningKey: FREE_TIER_WARNING } : {})
    };
  }
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
