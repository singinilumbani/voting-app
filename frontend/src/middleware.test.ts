import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

describe("host middleware", () => {
  it("redirects host routes to the landing page without a session cookie", () => {
    const request = new NextRequest("https://app.example.test/host/stations");
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.test/");
  });

  it("allows a host route when the session cookie exists", () => {
    const request = new NextRequest("https://app.example.test/host/stations", {
      headers: { cookie: "host_session=session-value" },
    });
    const response = middleware(request);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
