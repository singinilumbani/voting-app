import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { test } from "@playwright/test";

export const appUrl =
  process.env.PLAYWRIGHT_APP_URL ?? "http://localhost:3000";
export const apiBase =
  process.env.PLAYWRIGHT_API_BASE ?? "http://localhost:8787";

export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
}

export function uniqueUsername(prefix = "e2e"): string {
  return `${prefix}${uniqueSuffix()}`.replace(/[^A-Za-z0-9]/g, "").slice(0, 80);
}

export function uniquePhone(): string {
  const suffix = String(Math.floor(1000000 + Math.random() * 8999999));
  return `2659${suffix}`;
}

export async function requireBackend(request: APIRequestContext): Promise<void> {
  let reachable = false;
  try {
    const response = await request.get(`${apiBase}/api/v1/health`);
    reachable = response.ok();
  } catch {
    reachable = false;
  }
  test.skip(
    !reachable,
    `Backend is not reachable at ${apiBase}. Start the backend yourself before running Playwright e2e tests.`,
  );
}

export async function signupHost(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In / Sign Up" }).first().click();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.getByRole("button", { name: /Temporary Account/ }).click();
  await page.getByRole("button", { name: "Understand and continue" }).click();

  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`${username}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`Aa1!${username}Secure`);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(`Aa1!${username}Secure`);
  await page.getByRole("checkbox", { name: /Terms of Use/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/host(?:\/|$)/, { timeout: 30_000 });
}

export async function mockCloudinaryUpload(page: Page): Promise<void> {
  await page.route("**/api/v1/host/stations/*/uploads/sign", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cloudName: "demo",
        apiKey: "e2e-api-key",
        timestamp: Math.floor(Date.now() / 1000),
        signature: "e2e-signature",
        folder: "voting-app",
      }),
    });
  });
  await page.route("https://api.cloudinary.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        secure_url:
          "https://res.cloudinary.com/demo/image/upload/e2e-candidate.png",
      }),
    });
  });
}

export async function createAndLaunchStation(
  page: Page,
  options: {
    name: string;
    mode: "CLOSED_VOTE" | "PUBLIC_POLL";
    mobileOnly: boolean;
  },
): Promise<{ publicId: string; shareLink: string }> {
  await mockCloudinaryUpload(page);
  await page.goto("/host/stations/new");

  await page.getByRole("textbox", { name: "Station name" }).fill(options.name);
  await page
    .getByRole("radio", {
      name: options.mode === "CLOSED_VOTE" ? /Closed Vote/ : /Public Poll/,
    })
    .check();
  await page
    .getByRole("radio", { name: "Immediate live results" })
    .check();
  const mobileToggle = page.getByRole("switch", { name: "Mobile devices only" });
  if (await mobileToggle.isChecked()) {
    if (!options.mobileOnly) await mobileToggle.click();
  } else if (options.mobileOnly) {
    await mobileToggle.click();
  }
  await page.getByRole("button", { name: "Next" }).click();

  await page
    .getByRole("textbox", { name: "Position or category name" })
    .fill("Chairperson");
  await page.getByRole("button", { name: "Add position" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await page
    .getByRole("button", { name: "Add candidate to Chairperson" })
    .click();
  await page
    .getByRole("textbox", { name: "Candidate name" })
    .fill("Candidate One");
  await page
    .getByLabel("Choose candidate image")
    .setInputFiles({
      name: "candidate.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gJ/muXkSwAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save" })
    .click();

  await page
    .getByRole("button", { name: "Add candidate to Chairperson" })
    .click();
  await page
    .getByRole("textbox", { name: "Candidate name" })
    .fill("Candidate Two");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save" })
    .click();
  await page.getByRole("button", { name: "Next" }).click();

  if (options.mode === "CLOSED_VOTE") {
    await page
      .getByRole("spinbutton", { name: "Estimated Voter Count" })
      .fill("20");
    await page
      .getByRole("spinbutton", {
        name: "Registration duration in hours",
      })
      .fill("1");
    await page.getByRole("button", { name: "Next" }).click();
  }

  await page
    .getByRole("radio", { name: "Open now" })
    .check();
  await page
    .getByRole("spinbutton", { name: "Voting duration in minutes" })
    .fill("15");
  await page
    .getByRole("button", { name: "Review and launch" })
    .click();
  await page
    .getByRole("dialog", { name: "Launch polling station?" })
    .getByRole("button", { name: "Launch Polling Station" })
    .click();
  await page.getByRole("heading", { name: "Polling station launched" }).waitFor();

  const shareLink = await page
    .getByRole("textbox", { name: "Polling station link" })
    .inputValue();
  const publicId = shareLink.match(/\/s\/([^/?#]+)/)?.[1];
  if (!publicId) throw new Error("Could not find publicId in launch link.");
  return { publicId, shareLink };
}

export async function findStationByName(
  context: BrowserContext,
  name: string,
): Promise<{ id: string; publicId: string }> {
  const response = await context.request.get(
    `${appUrl}/api/v1/host/stations`,
  );
  if (!response.ok()) throw new Error(`Station list failed: ${response.status()}`);
  const body = (await response.json()) as {
    stations: Array<{ id?: string; stationId?: string; publicId: string; name: string }>;
  };
  const station = body.stations.find((item) => item.name === name);
  if (!station) throw new Error(`Station not found: ${name}`);
  return {
    id: station.id ?? station.stationId ?? "",
    publicId: station.publicId,
  };
}
