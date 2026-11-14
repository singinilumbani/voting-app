import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, apiFetch, apiFetchWithStatus } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("maps structured API failures to ApiError fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              key: "errors.auth.unauthorized",
              params: { reason: "expired" },
              requestId: "request-123",
            },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const request = apiFetch("/api/v1/test", z.object({ ok: z.boolean() }));
    await expect(request).rejects.toMatchObject({
      key: "errors.auth.unauthorized",
      params: { reason: "expired" },
      status: 401,
      requestId: "request-123",
    });
    await expect(request).rejects.toBeInstanceOf(ApiError);
  });

  it("includes credentials and parses typed JSON responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/api/v1/test", z.object({ ok: z.boolean() })),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/test"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("preserves successful HTTP status for verification-gated signup flows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accountType: "LONG_TERM" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      apiFetchWithStatus(
        "/api/v1/host/auth/signup",
        z.object({ accountType: z.enum(["TEMPORARY", "LONG_TERM"]) }),
      ),
    ).resolves.toEqual({
      data: { accountType: "LONG_TERM" },
      status: 202,
    });
  });
});
