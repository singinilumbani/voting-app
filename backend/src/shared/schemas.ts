import { z } from 'zod';

export const accountTypeSchema = z.enum(['TEMPORARY', 'LONG_TERM']);
export const planSchema = z.enum(['FREE', 'PAY_PER_USE', 'PREMIUM']);
export const stationModeSchema = z.enum(['PUBLIC_POLL', 'CLOSED_VOTE']);
export const stationStatusSchema = z.enum([
  'DRAFT',
  'REG_OPEN',
  'REG_CLOSED',
  'VOTE_OPEN',
  'VOTE_CLOSED',
  'ARCHIVED',
  'CANCELLED'
]);
export const resultsVisibilitySchema = z.enum(['IMMEDIATE', 'CONCEALED']);
export const approvalStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REVOKED']);

export const phoneNormalizationErrorSchema = z.enum([
  'TOO_SHORT',
  'TOO_LONG',
  'NOT_MOBILE',
  'SPREADSHEET_DAMAGED',
  'EMPTY',
  'INVALID_CHARACTERS'
]);

export const phoneNormalizationSuccessSchema = z.object({
  ok: z.literal(true),
  canonical: z.string().regex(/^[1-9]\d{7,14}$/),
  display: z.string(),
  whatsappUrl: z.string().url(),
  isInternational: z.boolean()
});

export const phoneNormalizationFailureSchema = z.object({
  ok: z.literal(false),
  reason: phoneNormalizationErrorSchema
});

export const phoneNormalizationResultSchema = z.discriminatedUnion('ok', [
  phoneNormalizationSuccessSchema,
  phoneNormalizationFailureSchema
]);

export const phoneListEntrySchema = z.object({
  original: z.string(),
  result: phoneNormalizationSuccessSchema
});

export const phoneListAttentionSchema = z.object({
  original: z.string(),
  reason: phoneNormalizationErrorSchema
});

export const phoneListResultSchema = z.object({
  valid: z.array(phoneListEntrySchema),
  fixed: z.array(phoneListEntrySchema),
  needsAttention: z.array(phoneListAttentionSchema),
  duplicatesMerged: z.number().int().nonnegative()
});

export const pollingStationDtoSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().min(1),
  name: z.string().min(1),
  mode: stationModeSchema,
  status: stationStatusSchema,
  resultsVisibility: resultsVisibilitySchema,
  allowAbstain: z.boolean(),
  mobileOnly: z.boolean(),
  voterCap: z.number().int().min(2).max(50_000)
});

export const categoryDtoSchema = z.object({
  id: z.string().uuid(),
  pollingStationId: z.string().uuid(),
  title: z.string().min(1),
  displayOrder: z.number().int()
});

export const candidateDtoSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  cloudinaryImageUrl: z.string().url().nullable()
});

export const voterRegistrationDtoSchema = z.object({
  pollingStationId: z.string().uuid(),
  fullName: z.string().min(1),
  phoneNumber: z.string().min(1)
});

export const voterStatusDtoSchema = z.object({
  id: z.string().uuid(),
  approvalStatus: approvalStatusSchema,
  hasVoted: z.boolean()
});

export const tokenNormalizationFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.enum(['INVALID_LENGTH', 'INVALID_CHARACTERS'])
});

export const tokenNormalizationSuccessSchema = z.object({
  ok: z.literal(true),
  normalized: z.string().regex(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$/)
});

export const tokenNormalizationResultSchema = z.discriminatedUnion('ok', [
  tokenNormalizationSuccessSchema,
  tokenNormalizationFailureSchema
]);

export type AccountType = z.infer<typeof accountTypeSchema>;
export type Plan = z.infer<typeof planSchema>;
export type StationMode = z.infer<typeof stationModeSchema>;
export type StationStatus = z.infer<typeof stationStatusSchema>;
export type ResultsVisibility = z.infer<typeof resultsVisibilitySchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type PhoneNormalizationError = z.infer<typeof phoneNormalizationErrorSchema>;
export type PhoneNormalizationSuccess = z.infer<typeof phoneNormalizationSuccessSchema>;
export type PhoneNormalizationFailure = z.infer<typeof phoneNormalizationFailureSchema>;
export type PhoneNormalizationResult = z.infer<typeof phoneNormalizationResultSchema>;
export type PhoneListEntry = z.infer<typeof phoneListEntrySchema>;
export type PhoneListAttention = z.infer<typeof phoneListAttentionSchema>;
export type PhoneListResult = z.infer<typeof phoneListResultSchema>;
export type PollingStationDto = z.infer<typeof pollingStationDtoSchema>;
export type CategoryDto = z.infer<typeof categoryDtoSchema>;
export type CandidateDto = z.infer<typeof candidateDtoSchema>;
export type VoterRegistrationDto = z.infer<typeof voterRegistrationDtoSchema>;
export type VoterStatusDto = z.infer<typeof voterStatusDtoSchema>;
export type TokenNormalizationResult = z.infer<typeof tokenNormalizationResultSchema>;
