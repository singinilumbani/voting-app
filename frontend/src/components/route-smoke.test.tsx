import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";
import Forbidden from "@/app/forbidden";
import Offline from "@/app/offline/page";
import Maintenance from "@/app/maintenance/page";

describe("remaining screen route smoke", () => {
  it("has app files for every route listed in docs/screens.md", () => {
    const routes = [
      "/",
      "/terms",
      "/privacy",
      "/forgot-password",
      "/check-email",
      "/reset-password",
      "/reset-success",
      "/reset-link-expired",
      "/verify-email-pending",
      "/verify-email",
      "/verify-email-verified",
      "/verification-link-expired",
      "/host",
      "/host/billing",
      "/host/profile",
      "/host/stations/new",
      "/host/stations/[id]",
      "/host/stations/[id]/overview",
      "/host/stations/[id]/candidates",
      "/host/stations/[id]/voters",
      "/host/stations/[id]/analytics",
      "/host/stations/[id]/settings",
      "/host/stations/[id]/edit",
      "/s/[publicId]",
      "/s/[publicId]/register",
      "/s/[publicId]/status",
      "/s/[publicId]/vote",
      "/s/[publicId]/ballot",
      "/s/[publicId]/success",
      "/s/[publicId]/results",
      "/dev/components",
      "/maintenance",
      "/offline",
    ];

    for (const route of routes) {
      let relative =
        route === "/" ? "src/app/page.tsx" : `src/app${route}/page.tsx`;
      if (
        route.startsWith("/host/stations/[id]/") &&
        ["/overview", "/candidates", "/voters", "/analytics", "/settings"].some(
          (tab) => route.endsWith(tab),
        )
      ) {
        relative = "src/app/host/stations/[id]/[tab]/page.tsx";
      }
      expect(existsSync(resolve(process.cwd(), relative)), route).toBe(true);
    }
  });

  it("renders shared status pages without errors", () => {
    const { rerender } = render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    rerender(<Forbidden />);
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeVisible();
    rerender(<Offline />);
    expect(screen.getByRole("heading", { name: "You are offline" })).toBeVisible();
    rerender(<Maintenance />);
    expect(screen.getByRole("heading", { name: "Maintenance in progress" })).toBeVisible();
  });
});
