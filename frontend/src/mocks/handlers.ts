import type { RequestHandler } from "msw";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import type { HostDto, StationDto } from "@/lib/api/schemas";
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
let mockStations: StationDto[] = [];
const mockStationActivity = new Map<
  string,
  { eventType: string; createdAt: string }[]
>();

function findMockStation(id: string): StationDto | undefined {
  return mockStations.find(
    (station) => station.id === id || station.stationId === id,
  );
}

function replaceMockStation(updated: StationDto): void {
  mockStations = mockStations.map((station) =>
    station.id === updated.id ? updated : station,
  );
}

function addMockStationActivity(stationId: string, eventType: string): void {
  const entries = mockStationActivity.get(stationId) ?? [];
  mockStationActivity.set(stationId, [
    { eventType, createdAt: new Date().toISOString() },
    ...entries,
  ]);
}

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
  http.get("/api/v1/host/stations", ({ request }) => {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter");
    const search = url.searchParams.get("search")?.toLocaleLowerCase() ?? "";
    const stations = mockStations.filter((station) => {
      if (!station.name.toLocaleLowerCase().includes(search)) return false;
      if (filter === "Scheduled") return station.scheduled === true;
      if (filter === "Active") {
        return ["REG_OPEN", "REGISTRATION_OPEN", "VOTE_OPEN"].includes(
          station.status.toUpperCase(),
        );
      }
      if (filter === "Past") {
        return ["VOTE_CLOSED", "ARCHIVED", "PURGED", "CANCELLED"].includes(
          station.status.toUpperCase(),
        );
      }
      return true;
    });
    return HttpResponse.json({ stations });
  }),
  http.post("/api/v1/host/stations", async ({ request }) => {
    const body = z
      .object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        mode: z.enum(["PUBLIC_POLL", "CLOSED_VOTE"]),
        resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]).optional(),
        allowAbstain: z.boolean(),
        mobileOnly: z.boolean(),
      })
      .safeParse(await request.json());
    if (!body.success) {
      return HttpResponse.json(
        { error: { key: "errors.validation.failed" } },
        { status: 400 },
      );
    }
    const id = crypto.randomUUID();
    const station: StationDto = {
      id,
      stationId: id,
      publicId: crypto.randomUUID(),
      ...body.data,
      status: "DRAFT",
      regStartsAt: null,
      regEndsAt: null,
      voteStartsAt: null,
      voteEndsAt: null,
      registeredCount: 0,
      ballotsCast: 0,
      voterCap: 500,
      categories: [],
    };
    mockStations = [...mockStations, station];
    return HttpResponse.json({ station }, { status: 201 });
  }),
  http.get("/api/v1/host/stations/:stationId", ({ params }) => {
    const station = findMockStation(String(params.stationId));
    return station
      ? HttpResponse.json({ station })
      : HttpResponse.json(
          { error: { key: "errors.station.not_found" } },
          { status: 404 },
        );
  }),
  http.get("/api/v1/host/stations/:stationId/voters", ({ params, request }) => {
    const station = findMockStation(String(params.stationId));
    if (!station) {
      return HttpResponse.json(
        { error: { key: "errors.station.not_found" } },
        { status: 404 },
      );
    }
    const query = new URL(request.url).searchParams;
    const page = Number(query.get("page") ?? 1);
    return HttpResponse.json({
      voters: [],
      counts: {
        pending: 0,
        approved: 0,
        rejected: 0,
        revoked: 0,
        voted: 0,
        cap: station.voterCap ?? 500,
      },
      total: 0,
      page,
      pageSize: 25,
    });
  }),
  http.get(
    "/api/v1/host/stations/:stationId/voters/integrity",
    ({ params }) => {
      const station = findMockStation(String(params.stationId));
      return station
        ? HttpResponse.json({
            approvedVoters: station.approvedVoters ?? 0,
            ballotsCast: station.ballotsCast ?? 0,
            abstentions: 0,
            possibleDuplicates: 0,
            alert: (station.ballotsCast ?? 0) > (station.approvedVoters ?? 0),
          })
        : HttpResponse.json(
            { error: { key: "errors.station.not_found" } },
            { status: 404 },
          );
    },
  ),
  http.get(
    "/api/v1/host/stations/:stationId/voters/export.csv",
    ({ params }) =>
      findMockStation(String(params.stationId))
        ? new HttpResponse("full_name,phone_number,status\n", {
            headers: { "Content-Type": "text/csv" },
          })
        : HttpResponse.json(
            { error: { key: "errors.station.not_found" } },
            { status: 404 },
          ),
  ),
  http.get(
    "/api/v1/host/stations/:stationId/analytics/snapshot",
    ({ params }) => {
      const station = findMockStation(String(params.stationId));
      if (!station) {
        return HttpResponse.json(
          { error: { key: "errors.station.not_found" } },
          { status: 404 },
        );
      }
      const status = station.status.toUpperCase();
      const state = ["VOTE_OPEN", "VOTING_OPEN"].includes(status)
        ? "LIVE"
        : ["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED"].includes(status)
          ? "FINAL"
          : "WAITING";
      const now = new Date();
      const approvedVoters =
        station.mode === "CLOSED_VOTE" ? (station.approvedVoters ?? 0) : null;
      const ballotsCast = station.ballotsCast ?? 0;
      return HttpResponse.json({
        stationId: station.id ?? station.stationId ?? String(params.stationId),
        stationName: station.name,
        stationMode: station.mode,
        status: station.status,
        state,
        ballotsCast,
        approvedVoters,
        turnoutPercent:
          approvedVoters === null
            ? null
            : approvedVoters > 0
              ? (ballotsCast / approvedVoters) * 100
              : 0,
        possibleDuplicates: 0,
        timeRemainingSeconds:
          state === "LIVE" && station.voteEndsAt
            ? Math.max(
                0,
                Math.floor(
                  (Date.parse(station.voteEndsAt) - now.getTime()) / 1_000,
                ),
              )
            : null,
        categories: (station.categories ?? []).map((category) => ({
          categoryId: category.id,
          title: category.title,
          candidates: (category.candidates ?? []).map((candidate) => ({
            candidateId: candidate.id,
            name: candidate.name,
            imageUrl: candidate.imageUrl ?? candidate.picture ?? null,
            count: 0,
            percentage: 0,
            isLeader: false,
            isTie: false,
          })),
          abstentions: 0,
        })),
        abstentions: 0,
        lastUpdated: now.toISOString(),
      });
    },
  ),
  http.get("/api/v1/host/stations/:stationId/analytics/audit", ({ params }) =>
    findMockStation(String(params.stationId))
      ? HttpResponse.json({ events: [], limit: 500 })
      : HttpResponse.json(
          { error: { key: "errors.station.not_found" } },
          { status: 404 },
        ),
  ),
  http.get(
    "/api/v1/host/stations/:stationId/analytics/export.csv",
    ({ params }) =>
      findMockStation(String(params.stationId))
        ? new HttpResponse(
            "category,candidate,votes,percentage,is_leader,is_tie\n",
            { headers: { "Content-Type": "text/csv" } },
          )
        : HttpResponse.json(
            { error: { key: "errors.station.not_found" } },
            { status: 404 },
          ),
  ),
  http.patch(
    "/api/v1/host/stations/:stationId",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]).optional(),
          allowAbstain: z.boolean().optional(),
          mobileOnly: z.boolean().optional(),
        })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          {
            error: {
              key: station
                ? "errors.validation.failed"
                : "errors.station.not_found",
            },
          },
          { status: station ? 400 : 404 },
        );
      }
      const updated = { ...station, ...body.data };
      replaceMockStation(updated);
      return HttpResponse.json({ station: updated });
    },
  ),
  http.post(
    "/api/v1/host/stations/:stationId/categories",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({ title: z.string().min(1) })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          {
            error: {
              key: station
                ? "errors.validation.failed"
                : "errors.station.not_found",
            },
          },
          { status: station ? 400 : 404 },
        );
      }
      const category = {
        id: crypto.randomUUID(),
        title: body.data.title,
        candidates: [],
      };
      const updated = {
        ...station,
        categories: [...(station.categories ?? []), category],
      };
      replaceMockStation(updated);
      return HttpResponse.json({ category }, { status: 201 });
    },
  ),
  http.patch(
    "/api/v1/host/stations/:stationId/categories/:categoryId",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const categoryId = String(params.categoryId);
      const body = z
        .object({ title: z.string().min(1) })
        .safeParse(await request.json());
      const category = station?.categories?.find(
        (item) => item.id === categoryId,
      );
      if (!station || !category || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.station.category_not_found" } },
          { status: 404 },
        );
      }
      const updatedCategory = { ...category, title: body.data.title };
      replaceMockStation({
        ...station,
        categories: station.categories?.map((item) =>
          item.id === categoryId ? updatedCategory : item,
        ),
      });
      return HttpResponse.json({ category: updatedCategory });
    },
  ),
  http.put(
    "/api/v1/host/stations/:stationId/categories/order",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({ categoryIds: z.array(z.string()) })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      const categories = body.data.categoryIds
        .map((id) => station.categories?.find((item) => item.id === id))
        .filter((category) => category !== undefined);
      if (categories.length !== (station.categories?.length ?? 0)) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      replaceMockStation({ ...station, categories });
      return HttpResponse.json({ categories });
    },
  ),
  http.delete(
    "/api/v1/host/stations/:stationId/categories/:categoryId",
    ({ params }) => {
      const station = findMockStation(String(params.stationId));
      if (!station) return new HttpResponse(null, { status: 404 });
      replaceMockStation({
        ...station,
        categories: station.categories?.filter(
          (category) => category.id !== String(params.categoryId),
        ),
      });
      return new HttpResponse(null, { status: 204 });
    },
  ),
  http.post(
    "/api/v1/host/stations/:stationId/categories/:categoryId/candidates",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const categoryId = String(params.categoryId);
      const body = z
        .object({
          name: z.string().min(1),
          picture: z.string().url().nullable().optional(),
        })
        .safeParse(await request.json());
      const category = station?.categories?.find(
        (item) => item.id === categoryId,
      );
      if (!station || !category || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      const candidate = { id: crypto.randomUUID(), ...body.data };
      addMockStationActivity(String(params.stationId), "CANDIDATE_ADDED");
      replaceMockStation({
        ...station,
        categories: station.categories?.map((item) =>
          item.id === categoryId
            ? { ...item, candidates: [...(item.candidates ?? []), candidate] }
            : item,
        ),
      });
      return HttpResponse.json({ candidate }, { status: 201 });
    },
  ),
  http.patch(
    "/api/v1/host/stations/:stationId/candidates/:candidateId",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const candidateId = String(params.candidateId);
      const body = z
        .object({
          name: z.string().min(1).optional(),
          picture: z.string().url().nullable().optional(),
        })
        .safeParse(await request.json());
      const existingCandidate = station?.categories
        ?.flatMap((category) => category.candidates ?? [])
        .find((candidate) => candidate.id === candidateId);
      if (!station || !body.success || !existingCandidate) {
        return HttpResponse.json(
          { error: { key: "errors.station.candidate_not_found" } },
          { status: 404 },
        );
      }
      const updatedCandidate = { ...existingCandidate, ...body.data };
      addMockStationActivity(String(params.stationId), "CANDIDATE_EDITED");
      const categories = station.categories?.map((category) => ({
        ...category,
        candidates: category.candidates?.map((candidate) =>
          candidate.id === candidateId ? updatedCandidate : candidate,
        ),
      }));
      replaceMockStation({ ...station, categories });
      return HttpResponse.json({ candidate: updatedCandidate });
    },
  ),
  http.delete(
    "/api/v1/host/stations/:stationId/candidates/:candidateId",
    ({ params }) => {
      const station = findMockStation(String(params.stationId));
      if (!station) return new HttpResponse(null, { status: 404 });
      const candidateId = String(params.candidateId);
      replaceMockStation({
        ...station,
        categories: station.categories?.map((category) => ({
          ...category,
          candidates: category.candidates?.filter(
            (candidate) => candidate.id !== candidateId,
          ),
        })),
      });
      return new HttpResponse(null, { status: 204 });
    },
  ),
  http.post("/api/v1/host/stations/:stationId/uploads/sign", ({ params }) => {
    if (!findMockStation(String(params.stationId))) {
      return HttpResponse.json(
        { error: { key: "errors.station.not_found" } },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      cloudName: "demo",
      apiKey: "mock-api-key",
      timestamp: 1_800_000_000,
      signature: "mock-signature",
      folder: "voting-app",
    });
  }),
  http.put(
    "/api/v1/host/stations/:stationId/registration-config",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({
          voterCap: z.number().int().min(2).max(50_000),
          durationHours: z.number().int().min(1).max(24).optional(),
        })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      const updated = {
        ...station,
        voterCap: body.data.voterCap,
        registrationDurationHours: body.data.durationHours ?? 12,
      };
      replaceMockStation(updated);
      return HttpResponse.json({ station: updated });
    },
  ),
  http.put(
    "/api/v1/host/stations/:stationId/voting-config",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({
          startMode: z.enum(["NOW", "SCHEDULED"]),
          startsAt: z.string().datetime().optional(),
          durationMinutes: z.number().int().min(15).max(1_440).optional(),
        })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      const updated = {
        ...station,
        scheduled: body.data.startMode === "SCHEDULED",
        voteStartsAt: body.data.startsAt ?? null,
        votingDurationMinutes: body.data.durationMinutes ?? 720,
      };
      replaceMockStation(updated);
      return HttpResponse.json({ station: updated });
    },
  ),
  http.post("/api/v1/host/stations/:stationId/launch", ({ params }) => {
    const station = findMockStation(String(params.stationId));
    if (!station) {
      return HttpResponse.json(
        { error: { key: "errors.station.not_found" } },
        { status: 404 },
      );
    }
    const publicId = station.publicId;
    const updated = {
      ...station,
      status: station.mode === "CLOSED_VOTE" ? "REG_OPEN" : "VOTE_OPEN",
    };
    replaceMockStation(updated);
    return HttpResponse.json({
      station: updated,
      publicId,
      shareLink: `http://localhost:3000/s/${publicId}`,
    });
  }),
  http.get("/api/v1/host/stations/:stationId/activity-log", ({ params }) =>
    HttpResponse.json({
      activity: mockStationActivity.get(String(params.stationId)) ?? [],
    }),
  ),
  http.post(
    "/api/v1/host/stations/:stationId/extend-registration",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({ additionalHours: z.number().int().positive().max(24) })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      if (
        station.status !== "REG_OPEN" &&
        station.status !== "REGISTRATION_OPEN"
      ) {
        return HttpResponse.json(
          { error: { key: "errors.station.registration_not_open" } },
          { status: 409 },
        );
      }
      const end = station.regEndsAt
        ? Date.parse(station.regEndsAt)
        : Date.now();
      const updated = {
        ...station,
        regEndsAt: new Date(
          end + body.data.additionalHours * 60 * 60 * 1000,
        ).toISOString(),
      };
      replaceMockStation(updated);
      addMockStationActivity(String(params.stationId), "REGISTRATION_EXTENDED");
      return HttpResponse.json({ station: updated });
    },
  ),
  http.patch(
    "/api/v1/host/stations/:stationId/voter-cap",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({ voterCap: z.number().int().min(2).max(50_000) })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      if (body.data.voterCap <= (station.voterCap ?? 0)) {
        return HttpResponse.json(
          { error: { key: "errors.station.voter_cap_locked" } },
          { status: 409 },
        );
      }
      const updated = { ...station, voterCap: body.data.voterCap };
      replaceMockStation(updated);
      addMockStationActivity(String(params.stationId), "VOTER_CAP_INCREASED");
      return HttpResponse.json({ station: updated });
    },
  ),
  http.post(
    "/api/v1/host/stations/:stationId/start-voting",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({ confirm: z.literal(true).optional() })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      const pendingCount = 0;
      if (!body.data.confirm) {
        return HttpResponse.json({
          requiresConfirmation: true,
          warningKey: "warnings.station.pending_voters",
          pendingCount,
        });
      }
      const updated = { ...station, status: "VOTE_OPEN" };
      replaceMockStation(updated);
      addMockStationActivity(String(params.stationId), "VOTING_STARTED");
      return HttpResponse.json({
        requiresConfirmation: false,
        station: updated,
        pendingCount,
      });
    },
  ),
  http.post(
    "/api/v1/host/stations/:stationId/cancel",
    async ({ params, request }) => {
      const station = findMockStation(String(params.stationId));
      const body = z
        .object({ confirm: z.literal("CANCEL").optional() })
        .safeParse(await request.json());
      if (!station || !body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      if (station.status === "VOTE_OPEN" && body.data.confirm !== "CANCEL") {
        return HttpResponse.json(
          { error: { key: "errors.station.cancel_confirmation_required" } },
          { status: 409 },
        );
      }
      const updated = { ...station, status: "CANCELLED" };
      replaceMockStation(updated);
      addMockStationActivity(String(params.stationId), "STATION_CANCELLED");
      return HttpResponse.json({ station: updated });
    },
  ),
  http.post("https://api.cloudinary.com/v1_1/:cloudName/image/upload", () =>
    HttpResponse.json({
      secure_url:
        "https://res.cloudinary.com/demo/image/upload/mock-candidate.jpg",
    }),
  ),
  http.get("/api/v1/public/stations/:publicId", ({ params }) =>
    {
      const station = mockStations.find(
        (item) => item.publicId === String(params.publicId),
      );
      if (station) {
        return HttpResponse.json({
          station: {
            publicId: station.publicId,
            name: station.name,
            mode: station.mode,
            status: station.status,
            regStartsAt: station.regStartsAt ?? null,
            regEndsAt: station.regEndsAt ?? null,
            voteStartsAt: station.voteStartsAt ?? null,
            voteEndsAt: station.voteEndsAt ?? null,
            mobileOnly: station.mobileOnly,
            allowAbstain: station.allowAbstain,
            resultsVisibility: station.resultsVisibility,
            categories: station.categories ?? [],
          },
        });
      }
      return HttpResponse.json({
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
      });
    },
  ),
  http.post(
    "/api/v1/public/stations/:publicId/register",
    async ({ request }) => {
      const body = z
        .object({
          fullName: z.string().min(1),
          phone: z.string().min(1),
          deviceUuid: z.string().uuid(),
          fingerprintHash: z.string(),
        })
        .safeParse(await request.json());
      if (!body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      return HttpResponse.json(
        {
          token: "TK-K7QM-2XD9-4HNP",
          status: "PENDING",
        },
        { status: 201 },
      );
    },
  ),
  http.post(
    "/api/v1/public/stations/:publicId/status",
    async ({ request }) => {
      const body = z
        .object({ token: z.string().min(1) })
        .safeParse(await request.json());
      if (!body.success) {
        return HttpResponse.json(
          { error: { key: "errors.validation.failed" } },
          { status: 400 },
        );
      }
      return HttpResponse.json({ status: "PENDING" });
    },
  ),
];
