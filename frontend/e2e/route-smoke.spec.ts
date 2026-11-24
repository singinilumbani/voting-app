import { test, expect } from "@playwright/test";
import { requireBackend } from "./helpers";

test.describe("route smoke", () => {
  test.beforeAll(async ({ request }) => {
    await requireBackend(request);
  });

  test("public and shared routes render", async ({ page }) => {
    for (const route of [
      "/",
      "/terms",
      "/privacy",
      "/forgot-password",
      "/maintenance",
      "/offline",
      "/not-a-real-route",
    ]) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
