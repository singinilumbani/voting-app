import { describe, expect, it } from 'vitest';
import { StationLifecycle } from './station-lifecycle.js';

const lifecycle = new StationLifecycle();

describe('StationLifecycle', () => {
  it.each([
    ['PUBLIC_POLL', 'DRAFT', 'VOTE_OPEN'],
    ['PUBLIC_POLL', 'VOTE_OPEN', 'VOTE_CLOSED'],
    ['PUBLIC_POLL', 'VOTE_CLOSED', 'ARCHIVED'],
    ['CLOSED_VOTE', 'DRAFT', 'REG_OPEN'],
    ['CLOSED_VOTE', 'REG_OPEN', 'REG_CLOSED'],
    ['CLOSED_VOTE', 'REG_CLOSED', 'VOTE_OPEN'],
    ['CLOSED_VOTE', 'VOTE_OPEN', 'VOTE_CLOSED'],
    ['CLOSED_VOTE', 'VOTE_CLOSED', 'ARCHIVED']
  ] as const)('allows %s transition %s to %s', (mode, current, next) => {
    expect(lifecycle.transition(mode, current, next)).toEqual({ ok: true, status: next });
  });

  it.each([
    ['PUBLIC_POLL', 'DRAFT', 'REG_OPEN'],
    ['PUBLIC_POLL', 'REG_OPEN', 'VOTE_OPEN'],
    ['CLOSED_VOTE', 'DRAFT', 'VOTE_OPEN'],
    ['CLOSED_VOTE', 'VOTE_CLOSED', 'CANCELLED'],
    ['PUBLIC_POLL', 'VOTE_CLOSED', 'CANCELLED'],
    ['CLOSED_VOTE', 'ARCHIVED', 'CANCELLED']
  ] as const)('rejects %s transition %s to %s', (mode, current, next) => {
    expect(lifecycle.transition(mode, current, next).ok).toBe(false);
  });

  it('requires confirmation to cancel after voting starts', () => {
    expect(lifecycle.transition('PUBLIC_POLL', 'VOTE_OPEN', 'CANCELLED')).toEqual({
      ok: false,
      reason: 'confirmation_required'
    });
    expect(lifecycle.transition('PUBLIC_POLL', 'VOTE_OPEN', 'CANCELLED', 'CANCEL')).toEqual({
      ok: true,
      status: 'CANCELLED'
    });
  });

  it.each([
    ['PUBLIC_POLL', 'DRAFT'],
    ['PUBLIC_POLL', 'VOTE_OPEN'],
    ['CLOSED_VOTE', 'DRAFT'],
    ['CLOSED_VOTE', 'REG_OPEN'],
    ['CLOSED_VOTE', 'REG_CLOSED'],
    ['CLOSED_VOTE', 'VOTE_OPEN']
  ] as const)('allows cancellation before voting closes: %s %s', (mode, current) => {
    const confirmation = current === 'VOTE_OPEN' ? 'CANCEL' : undefined;
    expect(lifecycle.transition(mode, current, 'CANCELLED', confirmation)).toEqual({
      ok: true,
      status: 'CANCELLED'
    });
  });

  it.each([
    ['PUBLIC_POLL', 'VOTE_CLOSED'],
    ['PUBLIC_POLL', 'ARCHIVED'],
    ['CLOSED_VOTE', 'VOTE_CLOSED'],
    ['CLOSED_VOTE', 'ARCHIVED']
  ] as const)('forbids cancellation after voting closes: %s %s', (mode, current) => {
    expect(lifecycle.transition(mode, current, 'CANCELLED', 'CANCEL').ok).toBe(false);
  });

  it('derives scheduling from state and a future start time', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const future = new Date('2026-01-02T00:00:00.000Z');
    expect(
      lifecycle.isScheduled(
        { mode: 'PUBLIC_POLL', status: 'DRAFT', isLaunched: true, voteStartsAt: future },
        now
      )
    ).toBe(true);
    expect(
      lifecycle.isScheduled(
        { mode: 'CLOSED_VOTE', status: 'REG_CLOSED', isLaunched: true, voteStartsAt: future },
        now
      )
    ).toBe(true);
    expect(
      lifecycle.isScheduled(
        { mode: 'PUBLIC_POLL', status: 'DRAFT', isLaunched: false, voteStartsAt: future },
        now
      )
    ).toBe(false);
  });
});
