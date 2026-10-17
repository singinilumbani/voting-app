export const NATIONAL_NUMBER_LENGTH = 9;
export const MOBILE_NATIONAL_PREFIXES = ['8', '9'] as const;
export const PHONE_NUMBER_RULE = Object.freeze({
  countryCallingCode: '265',
  nationalNumberLength: NATIONAL_NUMBER_LENGTH,
  mobileNumberPrefixes: MOBILE_NATIONAL_PREFIXES
});

export const VOTER_TOKEN = Object.freeze({
  prefix: 'TK',
  payloadLength: 12,
  groupLength: 4,
  alphabet: '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
});

export const REGISTRATION_WINDOW = Object.freeze({
  minimumMilliseconds: 60 * 60 * 1000,
  maximumMilliseconds: 24 * 60 * 60 * 1000,
  defaultMilliseconds: 12 * 60 * 60 * 1000
});

export const VOTING_WINDOW = Object.freeze({
  minimumMilliseconds: 15 * 60 * 1000,
  maximumMilliseconds: 24 * 60 * 60 * 1000,
  defaultMilliseconds: 12 * 60 * 60 * 1000,
  startWithinMilliseconds: 7 * 24 * 60 * 60 * 1000
});

export const VOTER_CAP = Object.freeze({
  minimum: 2,
  default: 500,
  maximum: 50_000,
  recommendedFreeTierLimit: 2_500
});

export const PUBLIC_POLL = Object.freeze({
  ballotCeilingDefault: 2_500
});

export const TOKEN_LOCKOUT = Object.freeze({
  attemptsBeforeLock: 5,
  lockDurationMilliseconds: 15 * 60 * 1000,
  attemptsBeforeFlag: 10
});

export const REJECTED_REGISTRATION = Object.freeze({
  maximumAttemptsPerPhone: 3
});

export const STATUS_PAGE = Object.freeze({
  pollingIntervalMilliseconds: 30 * 1000
});
