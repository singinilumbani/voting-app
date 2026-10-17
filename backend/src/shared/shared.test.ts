import { describe, expect, it } from 'vitest';
import {
  accountTypeSchema,
  approvalStatusSchema,
  candidateDtoSchema,
  categoryDtoSchema,
  MESSAGE_KEYS,
  normalizePhone,
  parsePhoneList,
  PHONE_NUMBER_RULE,
  pollingStationDtoSchema,
  phoneNormalizationResultSchema,
  phoneListResultSchema,
  planSchema,
  PUBLIC_POLL,
  REJECTED_REGISTRATION,
  REGISTRATION_WINDOW,
  resultsVisibilitySchema,
  stationModeSchema,
  stationStatusSchema,
  STATUS_PAGE,
  TOKEN_LOCKOUT,
  VOTER_CAP,
  VOTER_TOKEN,
  VOTING_WINDOW,
  voterRegistrationDtoSchema,
  voterStatusDtoSchema
} from './index.js';

describe('shared constants and common schemas', () => {
  it('exports the documented configurable mobile-number assumption', () => {
    expect(PHONE_NUMBER_RULE).toEqual({
      countryCallingCode: '265',
      nationalNumberLength: 9,
      mobileNumberPrefixes: ['8', '9']
    });
  });

  it('exports specification section 11.1 defaults and caps', () => {
    expect(REGISTRATION_WINDOW).toEqual({
      minimumMilliseconds: 3_600_000,
      maximumMilliseconds: 86_400_000,
      defaultMilliseconds: 43_200_000
    });
    expect(VOTING_WINDOW).toEqual({
      minimumMilliseconds: 900_000,
      maximumMilliseconds: 86_400_000,
      defaultMilliseconds: 43_200_000,
      startWithinMilliseconds: 604_800_000
    });
    expect(VOTER_CAP).toEqual({
      minimum: 2,
      default: 500,
      maximum: 50_000,
      recommendedFreeTierLimit: 2_500
    });
    expect(PUBLIC_POLL.ballotCeilingDefault).toBe(2_500);
    expect(TOKEN_LOCKOUT).toEqual({
      attemptsBeforeLock: 5,
      lockDurationMilliseconds: 900_000,
      attemptsBeforeFlag: 10
    });
    expect(REJECTED_REGISTRATION.maximumAttemptsPerPhone).toBe(3);
    expect(STATUS_PAGE.pollingIntervalMilliseconds).toBe(30_000);
    expect(VOTER_TOKEN).toMatchObject({ prefix: 'TK', payloadLength: 12, groupLength: 4 });
  });

  it('validates exported enum and DTO schemas', () => {
    expect(accountTypeSchema.parse('TEMPORARY')).toBe('TEMPORARY');
    expect(accountTypeSchema.safeParse('ADMIN').success).toBe(false);
    expect(planSchema.parse('PAY_PER_USE')).toBe('PAY_PER_USE');
    expect(stationModeSchema.parse('PUBLIC_POLL')).toBe('PUBLIC_POLL');
    expect(stationStatusSchema.parse('VOTE_OPEN')).toBe('VOTE_OPEN');
    expect(resultsVisibilitySchema.parse('CONCEALED')).toBe('CONCEALED');
    expect(approvalStatusSchema.parse('APPROVED')).toBe('APPROVED');
    expect(
      pollingStationDtoSchema.safeParse({
        id: 'cfe14a21-22c0-4525-a231-78ebf4e8de22',
        publicId: 'random-link-id',
        name: 'School Poll',
        mode: 'PUBLIC_POLL',
        status: 'DRAFT',
        resultsVisibility: 'CONCEALED',
        allowAbstain: false,
        mobileOnly: false,
        voterCap: 500
      }).success
    ).toBe(true);
    expect(
      pollingStationDtoSchema.safeParse({
        id: 'cfe14a21-22c0-4525-a231-78ebf4e8de22',
        publicId: 'random-link-id',
        name: 'School Poll',
        mode: 'PUBLIC_POLL',
        status: 'DRAFT',
        resultsVisibility: 'CONCEALED',
        allowAbstain: false,
        mobileOnly: false,
        voterCap: 50_001
      }).success
    ).toBe(false);
    expect(
      categoryDtoSchema.safeParse({
        id: 'cfe14a21-22c0-4525-a231-78ebf4e8de22',
        pollingStationId: '34b9e53e-8d24-4bab-9acb-d8a067119ed6',
        title: 'Chairperson',
        displayOrder: 1
      }).success
    ).toBe(true);
    expect(
      candidateDtoSchema.safeParse({
        id: 'cfe14a21-22c0-4525-a231-78ebf4e8de22',
        categoryId: '34b9e53e-8d24-4bab-9acb-d8a067119ed6',
        name: 'Candidate',
        cloudinaryImageUrl: null
      }).success
    ).toBe(true);
    expect(
      voterRegistrationDtoSchema.safeParse({
        pollingStationId: '34b9e53e-8d24-4bab-9acb-d8a067119ed6',
        fullName: 'Voter',
        phoneNumber: '0991234567'
      }).success
    ).toBe(true);
    expect(
      voterStatusDtoSchema.safeParse({
        id: 'cfe14a21-22c0-4525-a231-78ebf4e8de22',
        approvalStatus: 'PENDING',
        hasVoted: false
      }).success
    ).toBe(true);
  });

  it('exposes translation keys rather than user-facing copy', () => {
    expect(MESSAGE_KEYS.errors.phone.tooShort).toBe('errors.phone.too_short');
    expect(MESSAGE_KEYS.status.station.votingOpen).toBe('status.station.voting_open');
  });

  it('validates both international normalization results and phone-list DTOs', () => {
    const international = normalizePhone('+1 202 555 0123');
    const list = parsePhoneList('0991234567');

    expect(phoneNormalizationResultSchema.parse(international)).toMatchObject({
      ok: true,
      canonical: '12025550123',
      isInternational: true
    });
    expect(phoneListResultSchema.parse(list).valid).toHaveLength(1);
  });
});
