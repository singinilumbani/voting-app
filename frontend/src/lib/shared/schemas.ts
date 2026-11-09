import { z } from "zod";
import { PASSWORD_HASH_ALGORITHM, TOKEN_LENGTH } from "./constants";

export const phoneNormalizationSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    canonical: z.string().regex(/^\d+$/),
    display: z.string(),
    isInternational: z.boolean(),
    whatsappUrl: z.string().url().optional(),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum([
      "TOO_SHORT",
      "TOO_LONG",
      "NOT_MOBILE",
      "SPREADSHEET_DAMAGED",
      "EMPTY",
      "INVALID_CHARACTERS",
    ]),
  }),
]);

export const tokenNormalizationSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    normalized: z.string().length(TOKEN_LENGTH),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["INVALID_LENGTH", "INVALID_CHARACTERS"]),
  }),
]);

export const passwordHashPartsSchema = z.object({
  algorithm: z.literal(PASSWORD_HASH_ALGORITHM),
  iterations: z.number().int().positive(),
  salt: z.string().min(1),
  hash: z.string().min(1),
});
