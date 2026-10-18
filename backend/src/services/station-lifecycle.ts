import type { stationModeEnum, stationStatusEnum } from '../db/schema/enums.js';

export type StationMode = (typeof stationModeEnum.enumValues)[number];
export type StationStatus = (typeof stationStatusEnum.enumValues)[number];

const transitions: Record<StationMode, Partial<Record<StationStatus, StationStatus[]>>> = {
  PUBLIC_POLL: {
    DRAFT: ['VOTE_OPEN', 'CANCELLED'],
    VOTE_OPEN: ['VOTE_CLOSED', 'CANCELLED'],
    VOTE_CLOSED: ['ARCHIVED']
  },
  CLOSED_VOTE: {
    DRAFT: ['REG_OPEN', 'CANCELLED'],
    REG_OPEN: ['REG_CLOSED', 'CANCELLED'],
    REG_CLOSED: ['VOTE_OPEN', 'CANCELLED'],
    VOTE_OPEN: ['VOTE_CLOSED', 'CANCELLED'],
    VOTE_CLOSED: ['ARCHIVED']
  }
};

export class StationLifecycle {
  transition(
    mode: StationMode,
    current: StationStatus,
    next: StationStatus,
    confirm?: string
  ):
    | { ok: true; status: StationStatus }
    | { ok: false; reason: 'invalid_transition' | 'confirmation_required' } {
    if (current === 'VOTE_OPEN' && next === 'CANCELLED' && confirm !== 'CANCEL') {
      return { ok: false, reason: 'confirmation_required' };
    }
    if (!transitions[mode][current]?.includes(next)) {
      return { ok: false, reason: 'invalid_transition' };
    }
    return { ok: true, status: next };
  }

  isScheduled(
    station: {
      mode: StationMode;
      status: StationStatus;
      isLaunched: boolean;
      voteStartsAt: Date | null;
    },
    now: Date
  ): boolean {
    if (!station.voteStartsAt || station.voteStartsAt <= now) {
      return false;
    }
    return (
      (station.mode === 'CLOSED_VOTE' && station.status === 'REG_CLOSED') ||
      (station.mode === 'PUBLIC_POLL' && station.status === 'DRAFT' && station.isLaunched)
    );
  }
}
