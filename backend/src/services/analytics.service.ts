import { NotFoundError } from '../core/app-error.js';
import type {
  AnalyticsCategoryLeaderboard,
  AnalyticsRepositoryPort,
  AnalyticsSnapshot,
  AnalyticsSnapshotCache
} from './analytics.repository.js';

const CACHE_TTL_MS = 2_000;
const AUDIT_EVENT_LIMIT = 500;

export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepositoryPort,
    private readonly cache: AnalyticsSnapshotCache,
    private readonly now: () => Date = () => new Date()
  ) {}

  async snapshot(hostId: string, stationId: string): Promise<AnalyticsSnapshot> {
    const station = await this.repository.findOwnedStation(hostId, stationId);
    if (!station) throw new NotFoundError('errors.station.not_found');

    const now = this.now();
    const cached = this.cache.get(station.id, now.getTime());
    if (cached) return cached;

    const state =
      station.status === 'VOTE_CLOSED' || station.status === 'ARCHIVED'
        ? 'FINAL'
        : station.status === 'VOTE_OPEN' &&
            (!station.voteStartsAt || station.voteStartsAt.getTime() <= now.getTime())
          ? 'LIVE'
          : 'WAITING';

    const categories = await this.repository.listCategories(station.id);
    const candidates = await this.repository.listCandidates(station.id);
    const counts =
      state === 'WAITING'
        ? station.mode === 'CLOSED_VOTE'
          ? {
              ...(await this.repository.countClosedVoteBallots(station.id)),
              ballotsCast: 0
            }
          : { ballotsCast: 0, approvedVoters: null, possibleDuplicates: 0 }
        : station.mode === 'CLOSED_VOTE'
          ? await this.repository.countClosedVoteBallots(station.id)
          : await this.repository.countPublicPollBallots(station.id);
    const voteRows =
      state === 'WAITING' ? [] : await this.repository.countVotesByCategory(station.id);

    const ballotsBySelection = new Map(
      voteRows.map((row) => [`${row.categoryId}:${row.candidateId ?? 'ABSTAIN'}`, row.count])
    );
    const categoryResults: AnalyticsCategoryLeaderboard[] = categories.map((category) => {
      const categoryCandidates = candidates.filter(
        (candidate) => candidate.categoryId === category.id
      );
      const candidateCounts = categoryCandidates.map(
        (candidate) => ballotsBySelection.get(`${category.id}:${candidate.id}`) ?? 0
      );
      const abstentions = ballotsBySelection.get(`${category.id}:ABSTAIN`) ?? 0;
      const totalCategoryBallots =
        candidateCounts.reduce((total, candidateCount) => total + candidateCount, 0) + abstentions;
      const topCount = Math.max(0, ...candidateCounts);
      const tiedForTop = candidateCounts.filter(
        (candidateCount) => candidateCount === topCount
      ).length;

      return {
        categoryId: category.id,
        title: category.title,
        abstentions,
        candidates: categoryCandidates.map((candidate, index) => {
          const count = candidateCounts[index] ?? 0;
          const isLeader = topCount > 0 && count === topCount;
          return {
            candidateId: candidate.id,
            name: candidate.name,
            imageUrl: candidate.cloudinaryImageUrl,
            count,
            percentage:
              totalCategoryBallots === 0
                ? 0
                : Number(((count / totalCategoryBallots) * 100).toFixed(2)),
            isLeader,
            isTie: isLeader && tiedForTop > 1
          };
        })
      };
    });
    const abstentions = categoryResults.reduce((sum, category) => sum + category.abstentions, 0);
    const snapshot: AnalyticsSnapshot = {
      stationId: station.id,
      stationName: station.name,
      stationMode: station.mode,
      status: station.status,
      state,
      ballotsCast: counts.ballotsCast,
      approvedVoters: counts.approvedVoters,
      turnoutPercent:
        counts.approvedVoters === null
          ? null
          : counts.approvedVoters === 0
            ? 0
            : Number(((counts.ballotsCast / counts.approvedVoters) * 100).toFixed(2)),
      possibleDuplicates: counts.possibleDuplicates,
      timeRemainingSeconds:
        station.voteEndsAt === null
          ? null
          : Math.max(0, Math.ceil((station.voteEndsAt.getTime() - now.getTime()) / 1000)),
      categories: categoryResults,
      abstentions,
      lastUpdated: now.toISOString()
    };
    this.cache.set(station.id, snapshot, now.getTime());
    return snapshot;
  }

  async audit(hostId: string, stationId: string) {
    await this.requireOwnedStation(hostId, stationId);
    const events = await this.repository.listAuditRows(stationId, AUDIT_EVENT_LIMIT);
    return {
      events: events.map((event) => ({
        voterId: event.voterId,
        fullName: event.fullName,
        checkedInAt: event.votedAt
      })),
      limit: AUDIT_EVENT_LIMIT
    };
  }

  async exportCsv(hostId: string, stationId: string): Promise<string> {
    const snapshot = await this.snapshot(hostId, stationId);
    const rows: Array<Array<string | number | boolean>> = [
      ['category', 'candidate', 'votes', 'percentage', 'is_leader', 'is_tie'],
      ...snapshot.categories.flatMap((category) => [
        ...category.candidates.map((candidate) => [
          category.title,
          candidate.name,
          candidate.count,
          candidate.percentage,
          candidate.isLeader,
          candidate.isTie
        ]),
        [category.title, 'ABSTAIN', category.abstentions, '', false, false]
      ])
    ];
    return rows.map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n');
  }

  private async requireOwnedStation(hostId: string, stationId: string) {
    const station = await this.repository.findOwnedStation(hostId, stationId);
    if (!station) throw new NotFoundError('errors.station.not_found');
    return station;
  }
}

function csvCell(value: string | number | boolean): string {
  let text = String(value);
  if (/^[\t\r\n ]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export { CACHE_TTL_MS };
