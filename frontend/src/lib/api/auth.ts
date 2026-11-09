import { z } from "zod";
import { apiFetch } from "./client";
import {
  authStatusSchema,
  hostResponseSchema,
  profileUpdateResponseSchema,
  type HostDto,
} from "./schemas";

const credentialsSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(12).max(256),
});

const signupSchema = credentialsSchema.extend({
  email: z.string().email(),
  accountType: z.enum(["TEMPORARY", "LONG_TERM"]),
  termsAccepted: z.literal(true),
});

const requestAcceptedSchema = z.object({
  accountType: z.enum(["TEMPORARY", "LONG_TERM"]),
});

const meResponseSchema = hostResponseSchema;
const profileInputSchema = z
  .object({
    username: z.string().min(3).max(80).optional(),
    email: z.string().email().optional(),
  })
  .refine((value) => value.username !== undefined || value.email !== undefined);
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(256),
});
const tierChangeSchema = z.object({
  accountType: z.enum(["TEMPORARY", "LONG_TERM"]),
  confirm: z.literal("DELETE").optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type SignupRequest = z.infer<typeof signupSchema>;

export const authApi = {
  login(input: Credentials): Promise<{ host: HostDto }> {
    return apiFetch("/api/v1/host/auth/login", hostResponseSchema, {
      method: "POST",
      body: credentialsSchema.parse(input),
    });
  },
  signup(input: SignupRequest) {
    return apiFetch("/api/v1/host/auth/signup", requestAcceptedSchema, {
      method: "POST",
      body: signupSchema.parse(input),
    });
  },
  me(): Promise<{ host: HostDto }> {
    return apiFetch("/api/v1/host/auth/me", meResponseSchema);
  },
  logout(): Promise<undefined> {
    return apiFetch("/api/v1/host/auth/logout", z.undefined(), {
      method: "POST",
    });
  },
  forgotPassword(email: string) {
    const body = z.object({ email: z.string().email() }).parse({ email });
    return apiFetch("/api/v1/host/auth/forgot-password", authStatusSchema, {
      method: "POST",
      body,
    });
  },
  resetPassword(input: { token: string; password: string }) {
    const body = z
      .object({
        token: z.string().min(1),
        password: z.string().min(12).max(256),
      })
      .parse(input);
    return apiFetch("/api/v1/host/auth/reset-password", authStatusSchema, {
      method: "POST",
      body,
    });
  },
  verifyEmail(token: string) {
    const parsedToken = z.string().min(1).parse(token);
    const query = new URLSearchParams({ token: parsedToken });
    return apiFetch(
      `/api/v1/host/auth/verify-email?${query.toString()}`,
      authStatusSchema,
    );
  },
  updateProfile(input: z.infer<typeof profileInputSchema>) {
    return apiFetch("/api/v1/host/auth/profile", profileUpdateResponseSchema, {
      method: "PATCH",
      body: profileInputSchema.parse(input),
    });
  },
  changePassword(input: z.infer<typeof passwordChangeSchema>) {
    return apiFetch("/api/v1/host/auth/change-password", authStatusSchema, {
      method: "POST",
      body: passwordChangeSchema.parse(input),
    });
  },
  changeTier(input: z.infer<typeof tierChangeSchema>) {
    return apiFetch("/api/v1/host/auth/change-tier", hostResponseSchema, {
      method: "POST",
      body: tierChangeSchema.parse(input),
    });
  },
  exportData() {
    return apiFetch(
      "/api/v1/host/auth/export-data",
      z.record(z.string(), z.unknown()),
    );
  },
  deleteAccount() {
    return apiFetch("/api/v1/host/auth/account", z.undefined(), {
      method: "DELETE",
      body: { confirm: "DELETE" },
    });
  },
};
