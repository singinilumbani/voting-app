import type { RequestHandler } from "msw";
import { http, HttpResponse } from "msw";
import messages from "@/locales/en.json";

const host = {
  id: messages.mocks.hostId,
  username: messages.mocks.hostUsername,
  email: messages.mocks.hostEmail,
  accountType: "LONG_TERM",
  plan: "FREE",
  createdAt: messages.mocks.timestamp,
  purgeAt: null,
  lastLoginAt: messages.mocks.timestamp,
} as const;

let mockSessionActive = true;

export const handlers: RequestHandler[] = [
  http.post("/api/v1/host/auth/signup", () => {
    mockSessionActive = true;
    return HttpResponse.json({ accountType: "LONG_TERM" }, { status: 201 });
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
