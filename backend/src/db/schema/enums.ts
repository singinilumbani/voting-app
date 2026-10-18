import { pgEnum } from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', ['TEMPORARY', 'LONG_TERM']);
export const planEnum = pgEnum('plan', ['FREE', 'PAY_PER_USE', 'PREMIUM']);
export const stationModeEnum = pgEnum('station_mode', ['PUBLIC_POLL', 'CLOSED_VOTE']);
export const stationStatusEnum = pgEnum('station_status', [
  'DRAFT',
  'REG_OPEN',
  'REG_CLOSED',
  'VOTE_OPEN',
  'VOTE_CLOSED',
  'ARCHIVED',
  'CANCELLED'
]);
export const resultsVisibilityEnum = pgEnum('results_visibility', ['IMMEDIATE', 'CONCEALED']);
export const approvalStatusEnum = pgEnum('approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REVOKED'
]);
export const activityEventEnum = pgEnum('activity_event', [
  'CANDIDATE_ADDED',
  'CANDIDATE_EDITED',
  'VOTER_APPROVED',
  'VOTER_REJECTED',
  'VOTER_REVOKED',
  'TOKEN_REISSUED',
  'VOTER_BLOCKED'
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED'
]);
