import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../core/app-error.js';
import type {
  CandidateRecord,
  CategoryRecord,
  StationRepositoryPort,
  StationRecord
} from './station.repository.js';
import { StationService } from './station.service.js';
import { VOTER_CAP } from '../shared/constants.js';

const fixedNow = new Date('2026-10-18T08:00:00.000Z');
const hostId = '00000000-0000-4000-8000-000000000001';
const stationId = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000003';
const candidateId = '00000000-0000-4000-8000-000000000004';

describe('StationService', () => {
  it.each(['DRAFT', 'REG_OPEN'] as const)(
    'allows candidate create and edit in %s',
    async (status) => {
      const context = makeContext({ status });
      await context.service.createCandidate(hostId, stationId, categoryId, {
        name: 'Candidate Two'
      });
      await context.service.editCandidate(hostId, stationId, candidateId, { name: 'Renamed' });
      expect(context.activities).toEqual(['CANDIDATE_ADDED', 'CANDIDATE_EDITED']);
    }
  );

  it.each(['REG_CLOSED', 'VOTE_OPEN', 'VOTE_CLOSED', 'ARCHIVED', 'CANCELLED'] as const)(
    'locks candidate changes in %s',
    async (status) => {
      const context = makeContext({ status });
      await expect(
        context.service.createCandidate(hostId, stationId, categoryId, { name: 'Candidate Two' })
      ).rejects.toMatchObject({ key: 'errors.station.locked' });
      await expect(
        context.service.editCandidate(hostId, stationId, candidateId, { name: 'Renamed' })
      ).rejects.toMatchObject({ key: 'errors.station.locked' });
    }
  );

  it('allows candidate deletion only in DRAFT', async () => {
    const draft = makeContext({ status: 'DRAFT' });
    await draft.service.deleteCandidate(hostId, stationId, candidateId);
    expect(draft.deletedCandidates).toEqual([candidateId]);

    const registration = makeContext({ status: 'REG_OPEN' });
    await expect(
      registration.service.deleteCandidate(hostId, stationId, candidateId)
    ).rejects.toMatchObject({
      key: 'errors.station.locked'
    });
  });

  it('rejects station access when the host does not own it', async () => {
    const context = makeContext({ owned: false });
    await expect(context.service.detail(hostId, stationId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    [VOTER_CAP.minimum, 1, false],
    [VOTER_CAP.minimum, 24, false],
    [VOTER_CAP.minimum, 0, true],
    [VOTER_CAP.minimum, 25, true]
  ])('validates registration duration hours %s', async (_cap, duration, rejected) => {
    const context = makeContext();
    const result = context.service.setRegistrationConfig(hostId, stationId, 500, duration);
    if (rejected) {
      await expect(result).rejects.toMatchObject({ key: 'errors.validation.failed' });
    } else {
      await expect(result).resolves.toMatchObject({
        station: { registrationDurationHours: duration }
      });
    }
  });

  it.each([
    [15, false],
    [1440, false],
    [14, true],
    [1441, true]
  ])('validates voting duration boundary %i minutes', async (durationMinutes, rejected) => {
    const context = makeContext();
    const result = context.service.setVotingConfig(hostId, stationId, {
      startMode: 'NOW',
      durationMinutes
    });
    if (rejected) {
      await expect(result).rejects.toMatchObject({ key: 'errors.validation.failed' });
    } else {
      await expect(result).resolves.toMatchObject({ votingDurationMinutes: durationMinutes });
    }
  });

  it.each([
    ['2026-10-18T20:00:00.000Z', false],
    ['2026-10-25T20:00:00.000Z', false],
    ['2026-10-25T20:00:00.001Z', true],
    ['2026-10-18T19:59:59.999Z', true]
  ])('validates scheduled start boundary %s', async (startsAt, rejected) => {
    const context = makeContext();
    const result = context.service.setVotingConfig(hostId, stationId, {
      startMode: 'SCHEDULED',
      startsAt: new Date(startsAt),
      durationMinutes: 720
    });
    if (rejected) {
      await expect(result).rejects.toMatchObject({ key: 'errors.validation.failed' });
    } else {
      await expect(result).resolves.toMatchObject({ voteStartsAt: new Date(startsAt) });
    }
  });

  it('validates voter-cap boundaries and returns the free-tier warning', async () => {
    const context = makeContext();
    await expect(
      context.service.setRegistrationConfig(hostId, stationId, 1, 12)
    ).rejects.toMatchObject({
      key: 'errors.validation.failed'
    });
    await expect(
      context.service.setRegistrationConfig(hostId, stationId, 50_001, 12)
    ).rejects.toMatchObject({
      key: 'errors.validation.failed'
    });
    await expect(
      context.service.setRegistrationConfig(hostId, stationId, 2_501, 12)
    ).resolves.toMatchObject({
      warningKey: 'warnings.station.free_tier_voter_cap'
    });
  });
});

function makeContext(options: { status?: StationRecord['status']; owned?: boolean } = {}) {
  let station: StationRecord = {
    id: stationId,
    publicId: 'station-public-id',
    hostId,
    name: 'Test station',
    description: null,
    mode: 'CLOSED_VOTE',
    status: options.status ?? 'DRAFT',
    resultsVisibility: 'CONCEALED',
    allowAbstain: false,
    mobileOnly: false,
    voterCap: 500,
    registrationDurationHours: 12,
    votingDurationMinutes: 720,
    isLaunched: false,
    regStartsAt: null,
    regEndsAt: null,
    voteStartsAt: null,
    voteEndsAt: null,
    closedAt: null,
    createdAt: fixedNow
  };
  const categories: CategoryRecord[] = [
    {
      id: categoryId,
      pollingStationId: stationId,
      title: 'Office',
      displayOrder: 0,
      createdAt: fixedNow
    }
  ];
  const candidates: CandidateRecord[] = [
    {
      id: candidateId,
      categoryId,
      name: 'Candidate One',
      cloudinaryImageUrl: null,
      createdAt: fixedNow,
      updatedAt: fixedNow
    }
  ];
  const activities: string[] = [];
  const deletedCandidates: string[] = [];
  const repository: StationRepositoryPort = {
    async withTransaction(operation) {
      return operation(repository);
    },
    async createStation() {
      return station;
    },
    async findOwnedStation(foundHostId, foundStationId) {
      return options.owned === false || foundHostId !== hostId || foundStationId !== stationId
        ? undefined
        : station;
    },
    async findPublicStation() {
      return station;
    },
    async updateStation(foundHostId, foundStationId, values) {
      if (foundHostId !== hostId || foundStationId !== stationId) return undefined;
      station = { ...station, ...values } as StationRecord;
      return station;
    },
    async listOwnedStations() {
      return [station];
    },
    async listCategories() {
      return categories;
    },
    async createCategory(values) {
      const category = { ...categories[0]!, ...values, id: 'category-new' };
      categories.push(category);
      return category;
    },
    async findOwnedCategory(_foundHostId, foundStationId, foundCategoryId) {
      return foundStationId === stationId
        ? categories.find(({ id }) => id === foundCategoryId)
        : undefined;
    },
    async updateCategory(foundCategoryId, values) {
      const existing = categories.find(({ id }) => id === foundCategoryId);
      if (!existing) return undefined;
      Object.assign(existing, values);
      return existing;
    },
    async deleteCategory(foundCategoryId) {
      const index = categories.findIndex(({ id }) => id === foundCategoryId);
      if (index >= 0) categories.splice(index, 1);
    },
    async listCandidates() {
      return candidates;
    },
    async createCandidate(values) {
      const candidate = {
        ...candidates[0]!,
        ...values,
        id: 'candidate-new',
        createdAt: fixedNow,
        updatedAt: fixedNow
      };
      candidates.push(candidate);
      return candidate;
    },
    async findOwnedCandidate(_foundHostId, foundStationId, foundCandidateId) {
      return foundStationId === stationId
        ? candidates.find(({ id }) => id === foundCandidateId)
        : undefined;
    },
    async updateCandidate(foundCandidateId, values) {
      const candidate = candidates.find(({ id }) => id === foundCandidateId);
      if (!candidate) return undefined;
      Object.assign(candidate, values);
      return candidate;
    },
    async deleteCandidate(foundCandidateId) {
      deletedCandidates.push(foundCandidateId);
    },
    async addActivity(values) {
      activities.push(values.eventType);
    },
    async listActivity() {
      return [];
    },
    async countPendingVoters() {
      return 0;
    }
  };
  return {
    service: new StationService(repository, {
      config: {
        appBaseUrl: 'http://localhost:3000',
        cloudinaryUploadFolder: 'voting-app'
      },
      now: () => fixedNow,
      randomBytes: (size) => new Uint8Array(size).fill(1)
    }),
    activities,
    deletedCandidates
  };
}
