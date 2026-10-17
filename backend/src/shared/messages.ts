export const MESSAGE_KEYS = Object.freeze({
  errors: Object.freeze({
    phone: Object.freeze({
      tooShort: 'errors.phone.too_short',
      tooLong: 'errors.phone.too_long',
      notMobile: 'errors.phone.not_mobile',
      spreadsheetDamaged: 'errors.phone.spreadsheet_damaged',
      empty: 'errors.phone.empty',
      invalidCharacters: 'errors.phone.invalid_characters'
    }),
    token: Object.freeze({
      invalidLength: 'errors.token.invalid_length',
      invalidCharacters: 'errors.token.invalid_characters'
    }),
    validation: 'errors.validation'
  }),
  status: Object.freeze({
    voter: Object.freeze({
      pending: 'status.voter.pending',
      approved: 'status.voter.approved',
      rejected: 'status.voter.rejected',
      revoked: 'status.voter.revoked',
      voted: 'status.voter.voted'
    }),
    station: Object.freeze({
      draft: 'status.station.draft',
      registrationOpen: 'status.station.registration_open',
      registrationClosed: 'status.station.registration_closed',
      votingOpen: 'status.station.voting_open',
      votingClosed: 'status.station.voting_closed',
      archived: 'status.station.archived',
      cancelled: 'status.station.cancelled'
    })
  })
});

export type MessageKey =
  | (typeof MESSAGE_KEYS.errors.phone)[keyof typeof MESSAGE_KEYS.errors.phone]
  | (typeof MESSAGE_KEYS.errors.token)[keyof typeof MESSAGE_KEYS.errors.token]
  | typeof MESSAGE_KEYS.errors.validation
  | (typeof MESSAGE_KEYS.status.voter)[keyof typeof MESSAGE_KEYS.status.voter]
  | (typeof MESSAGE_KEYS.status.station)[keyof typeof MESSAGE_KEYS.status.station];
