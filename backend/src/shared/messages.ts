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
    hostAuth: Object.freeze({
      usernameTaken: 'errors.host_auth.username_taken',
      emailTaken: 'errors.host_auth.email_taken',
      invalidCredentials: 'errors.host_auth.invalid_credentials',
      rateLimited: 'errors.host_auth.rate_limited',
      resetTokenInvalid: 'errors.host_auth.reset_token_invalid',
      verificationTokenInvalid: 'errors.host_auth.verification_token_invalid',
      tierDowngradeConfirmationRequired: 'errors.host_auth.tier_downgrade_confirmation_required',
      currentPasswordInvalid: 'errors.host_auth.current_password_invalid',
      accountDeletionConfirmationRequired: 'errors.host_auth.account_deletion_confirmation_required'
    }),
    registration: Object.freeze({
      alreadyRegistered: 'errors.registration.already_registered',
      full: 'errors.registration.full',
      closed: 'errors.registration.closed',
      attemptsExceeded: 'errors.registration.attempts_exceeded',
      blocked: 'errors.registration.blocked',
      rateLimited: 'errors.registration.rate_limited',
      tokenGenerationFailed: 'errors.registration.token_generation_failed',
      createFailed: 'errors.registration.create_failed',
      notConfigured: 'errors.registration.not_configured',
      notFound: 'errors.registration.not_found'
    }),
    voter: Object.freeze({
      notFound: 'errors.voter.not_found',
      notPending: 'errors.voter.not_pending',
      approvalLocked: 'errors.voter.approval_locked',
      actionLocked: 'errors.voter.action_locked',
      revokeNotAllowed: 'errors.voter.revoke_not_allowed',
      reissueNotAllowed: 'errors.voter.reissue_not_allowed'
    }),
    vote: Object.freeze({
      invalidToken: 'errors.vote.invalid_token',
      tokenLocked: 'errors.vote.token_locked',
      alreadyVoted: 'errors.vote.already_voted',
      notApproved: 'errors.vote.not_approved',
      sessionInvalid: 'errors.vote.session_invalid',
      sessionExpired: 'errors.vote.session_expired',
      partialBallot: 'errors.vote.partial_ballot',
      invalidSelection: 'errors.vote.invalid_selection',
      abstainNotAllowed: 'errors.vote.abstain_not_allowed',
      duplicateDevice: 'errors.vote.duplicate_device',
      capacityReached: 'errors.vote.capacity_reached',
      resultsNotAvailable: 'errors.vote.results_not_available',
      resultsAccessRequired: 'errors.vote.results_access_required',
      notOpen: 'errors.vote.not_open',
      wrongMode: 'errors.vote.wrong_mode',
      notConfigured: 'errors.vote.not_configured'
    }),
    analytics: Object.freeze({
      notConfigured: 'errors.analytics.not_configured'
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
    }),
    hostAuth: Object.freeze({
      passwordResetIfExists: 'status.host_auth.password_reset_if_exists',
      passwordReset: 'status.host_auth.password_reset',
      emailVerified: 'status.host_auth.email_verified',
      passwordChanged: 'status.host_auth.password_changed'
    }),
    vote: Object.freeze({
      submitted: 'status.vote.submitted'
    })
  }),
  flags: Object.freeze({
    voter: Object.freeze({
      tokenAttemptsExceeded: 'flags.voter.token_attempts_exceeded'
    })
  })
});

export type MessageKey =
  | (typeof MESSAGE_KEYS.errors.phone)[keyof typeof MESSAGE_KEYS.errors.phone]
  | (typeof MESSAGE_KEYS.errors.token)[keyof typeof MESSAGE_KEYS.errors.token]
  | typeof MESSAGE_KEYS.errors.validation
  | (typeof MESSAGE_KEYS.errors.hostAuth)[keyof typeof MESSAGE_KEYS.errors.hostAuth]
  | (typeof MESSAGE_KEYS.errors.registration)[keyof typeof MESSAGE_KEYS.errors.registration]
  | (typeof MESSAGE_KEYS.errors.voter)[keyof typeof MESSAGE_KEYS.errors.voter]
  | (typeof MESSAGE_KEYS.errors.vote)[keyof typeof MESSAGE_KEYS.errors.vote]
  | (typeof MESSAGE_KEYS.errors.analytics)[keyof typeof MESSAGE_KEYS.errors.analytics]
  | (typeof MESSAGE_KEYS.status.voter)[keyof typeof MESSAGE_KEYS.status.voter]
  | (typeof MESSAGE_KEYS.status.station)[keyof typeof MESSAGE_KEYS.status.station]
  | (typeof MESSAGE_KEYS.status.hostAuth)[keyof typeof MESSAGE_KEYS.status.hostAuth]
  | (typeof MESSAGE_KEYS.status.vote)[keyof typeof MESSAGE_KEYS.status.vote]
  | (typeof MESSAGE_KEYS.flags.voter)[keyof typeof MESSAGE_KEYS.flags.voter];
