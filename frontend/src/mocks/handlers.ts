import type { RequestHandler } from "msw";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import type { HostDto } from "@/lib/api/schemas";
import messages from "@/locales/en.json";

let host: HostDto = {
  id: messages.mocks.hostId,
  username: messages.mocks.hostUsername,
  email: messages.mocks.hostEmail,
  accountType: "LONG_TERM",
  plan: "FREE",
  createdAt: messages.mocks.timestamp,
  purgeAt: null,
  lastLoginAt: messages.mocks.timestamp,
};

let mockSessionActive = true;

export const handlers: RequestHandler[] = [
  http.post("/api/v1/host/auth/signup", async ({ request }) => {
    const body = z
      .object({
        username: z.string().min(3).max(80),
        email: z.string().email(),
        accountType: z.enum(["TEMPORARY", "LONG_TERM"]),
        password: z.string().min(12).max(256),
        termsAccepted: z.literal(true),
      })
      .safeParse(await request.json());
    if (!body.success) {
      return HttpResponse.json(
        { error: { key: "errors.validation.failed" } },
        { status: 400 },
      );
    }
    host = {
      ...host,
      username: body.data.username,
      email: body.data.email,
      accountType: body.data.accountType,
    };
    mockSessionActive = true;
    return HttpResponse.json(
      { accountType: body.data.accountType },
      { status: 201 },
    );
  }),
  http.post("/api/v1/host/auth/login", () => {
    mockSessionActive = true;
    return HttpResponse.json({ host });
  }),
  http.get("/api/v1/host/auth/me", () =>
    mockSessionActive
      ? HttpResponse.json({ host })
      : HttpResponse.json(
          { error: { key: "errors.auth.unauthorized" } },
          { status: 401 },
        ),
  ),
  http.post("/api/v1/host/auth/logout", () => {
    mockSessionActive = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/v1/host/auth/forgot-password", () =>
    HttpResponse.json({
      messageKey: "status.host_auth.password_reset_if_exists",
    }),
  ),
  http.post("/api/v1/host/auth/reset-password", () =>
    HttpResponse.json({ messageKey: "status.host_auth.password_reset" }),
  ),
  http.get("/api/v1/host/auth/verify-email", () =>
    HttpResponse.json({ messageKey: "status.host_auth.email_verified" }),
  ),
  http.patch("/api/v1/host/auth/profile", async ({ request }) => {
    const body = z
      .object({
        username: z.string().min(3).max(80).optional(),
        email: z.string().email().optional(),
      })
      .safeParse(await request.json());
    if (!body.success) {
      return HttpResponse.json(
        { error: { key: "errors.validation.failed" } },
        { status: 400 },
      );
    }
    host = { ...host, ...body.data };
    return HttpResponse.json({ host, verificationRequired: false });
  }),
  http.post("/api/v1/host/auth/change-password", () =>
    HttpResponse.json({ messageKey: "status.host_auth.password_changed" }),
  ),
  http.post("/api/v1/host/auth/change-tier", async ({ request }) => {
    const body = z
      .object({
        accountType: z.enum(["TEMPORARY", "LONG_TERM"]),
        confirm: z.literal("DELETE").optional(),
      })
      .safeParse(await request.json());
    if (!body.success) {
      return HttpResponse.json(
        { error: { key: "errors.validation.failed" } },
        { status: 400 },
      );
    }
    if (
      host.accountType === "LONG_TERM" &&
      body.data.accountType === "TEMPORARY" &&
      body.data.confirm !== "DELETE"
    ) {
      return HttpResponse.json(
        {
          error: {
            key: "errors.host_auth.tier_downgrade_confirmation_required",
          },
        },
        { status: 400 },
      );
    }
    host = { ...host, accountType: body.data.accountType };
    return HttpResponse.json({ host });
  }),
  http.post("/api/v1/host/auth/export-data", () =>
    HttpResponse.json({
      host,
      stations: [],
      registeredVoters: [],
      deviceRecords: [],
      castVotes: [],
      activityLog: [],
      payments: [],
    }),
  ),
  http.delete("/api/v1/host/auth/account", () => {
    mockSessionActive = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/v1/public/stations/:publicId", ({ params }) =>
    HttpResponse.json({
      station: {
        publicId: String(params.publicId),
        name: messages.mocks.stationName,
        mode: "PUBLIC_POLL",
        status: "VOTE_OPEN",
        regStartsAt: null,
        regEndsAt: null,
        voteStartsAt: messages.mocks.timestamp,
        voteEndsAt: messages.mocks.nextDayTimestamp,
        mobileOnly: false,
        allowAbstain: false,
        resultsVisibility: "IMMEDIATE",
        categories: [],
      },
    }),
  ),
];
