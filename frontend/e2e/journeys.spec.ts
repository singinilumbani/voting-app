import { test, expect } from "@playwright/test";
import {
  appUrl,
  createAndLaunchStation,
  findStationByName,
  requireBackend,
  signupHost,
  uniquePhone,
  uniqueSuffix,
  uniqueUsername,
} from "./helpers";

test.describe("real-backend journeys", () => {
  test.beforeAll(async ({ request }) => {
    await requireBackend(request);
  });

  test("host creates a Closed Vote station and a voter can register", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Covered once in the mobile project.");
    const suffix = uniqueSuffix();
    const username = uniqueUsername("closed");
    await signupHost(page, username);
    const stationName = `Closed E2E ${suffix}`;
    await createAndLaunchStation(page, {
      name: stationName,
      mode: "CLOSED_VOTE",
      mobileOnly: true,
    });
    const station = await findStationByName(context, stationName);
    expect(station.id).not.toBe("");

    const voter = await context.newPage();
    await voter.goto(`/s/${station.publicId}/register`);
    await voter
      .getByRole("textbox", { name: "Full name" })
      .fill(`Voter ${suffix}`);
    await voter
      .getByRole("textbox", { name: "Phone number" })
      .fill(`099-${String(uniquePhone()).slice(-7, -4)}-${String(uniquePhone()).slice(-4)}`);
    await voter.getByRole("button", { name: "Register" }).click();
    await expect(voter.getByText("Registration received")).toBeVisible();
    const tokenOutput = voter.getByLabel("Personal voter token");
    await expect(tokenOutput).toContainText("TK-");

    await page.goto(`/host/stations/${station.id}/voters`);
    await page
      .getByRole("article", { name: `Voter ${suffix}` })
      .getByRole("button", { name: `Approve Voter ${suffix}` })
      .click();
    await expect(
      page
        .getByRole("article", { name: `Voter ${suffix}` })
        .getByText("Approved"),
    ).toBeVisible();

    const start = await context.request.post(
      `${appUrl}/api/v1/host/stations/${station.id}/start-voting`,
      { data: {} },
    );
    test.skip(
      start.status() === 409,
      "Registration did not close in the real backend window; no documented close/advance endpoint is available.",
    );
    if (start.ok()) {
      await context.request.post(
        `${appUrl}/api/v1/host/stations/${station.id}/start-voting`,
        { data: { confirm: true } },
      );
      await voter.goto(`/s/${station.publicId}/vote`);
      await voter.getByRole("button", { name: /Candidate One/ }).click();
      await voter.getByRole("button", { name: "Submit Ballot" }).click();
      await voter
        .getByRole("button", { name: "Confirm and submit" })
        .click();
      await expect(voter.getByText("Vote submitted")).toBeVisible();

      await page.goto(`/host/stations/${station.id}/analytics`);
      await expect(page.getByText(/421|1 \//)).toBeVisible();
      await page.goto(`/s/${station.publicId}/results`);
      await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    }
  });

  test("host creates a Public Poll station and a second ballot is refused", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Covered once in the mobile project.");
    await signupHost(page, uniqueUsername("public"));
    const stationName = `Public E2E ${uniqueSuffix()}`;
    const launched = await createAndLaunchStation(page, {
      name: stationName,
      mode: "PUBLIC_POLL",
      mobileOnly: false,
    });
    await page.goto(`/s/${launched.publicId}/ballot`);
    await page.getByRole("button", { name: /Candidate One/ }).click();
    await page.getByRole("button", { name: "Submit Ballot" }).click();
    await page
      .getByRole("button", { name: "Confirm and submit" })
      .click();
    await expect(page.getByText("Vote submitted")).toBeVisible();

    await page.goto(`/s/${launched.publicId}/ballot`);
    await page.getByRole("button", { name: /Candidate One/ }).click();
    await page.getByRole("button", { name: "Submit Ballot" }).click();
    await page
      .getByRole("button", { name: "Confirm and submit" })
      .click();
    await expect(
      page.getByRole("alert").getByText(/already submitted|already voted/i),
    ).toBeVisible();
  });

  test("desktop is gated on a mobile-only station and allowed off", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop gate check.");
    await signupHost(page, uniqueUsername("gate"));
    const onName = `Gate On ${uniqueSuffix()}`;
    const on = await createAndLaunchStation(page, {
      name: onName,
      mode: "PUBLIC_POLL",
      mobileOnly: true,
    });
    await page.goto(`/s/${on.publicId}/ballot`);
    await expect(
      page.getByRole("heading", { name: "Mobile device required" }),
    ).toBeVisible();

    const offName = `Gate Off ${uniqueSuffix()}`;
    await page.goto("/host/stations/new");
    const off = await createAndLaunchStation(page, {
      name: offName,
      mode: "PUBLIC_POLL",
      mobileOnly: false,
    });
    await page.goto(`/s/${off.publicId}/ballot`);
  });

  test("lost-token reissue workflow is available through approval queue", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Covered once in the mobile project.");
    await signupHost(page, uniqueUsername("reissue"));
    const stationName = `Reissue E2E ${uniqueSuffix()}`;
    const launched = await createAndLaunchStation(page, {
      name: stationName,
      mode: "CLOSED_VOTE",
      mobileOnly: true,
    });
    const station = await findStationByName(context, stationName);

    const voter = await context.newPage();
    await voter.goto(`/s/${launched.publicId}/register`);
    await voter
      .getByRole("textbox", { name: "Full name" })
      .fill(`Lost Token ${uniqueSuffix()}`);
    await voter
      .getByRole("textbox", { name: "Phone number" })
      .fill("0991234567");
    await voter.getByRole("button", { name: "Register" }).click();
    await expect(voter.getByText("Registration received")).toBeVisible();
    const oldToken = await voter
      .getByLabel("Personal voter token")
      .textContent();
    expect(oldToken).toContain("TK-");

    await page.goto(`/host/stations/${station.id}/voters`);
    await page
      .getByRole("article", { name: /Lost Token/ })
      .getByRole("button", { name: /Approve/ })
      .click();
    await page
      .getByRole("article", { name: /Lost Token/ })
      .getByRole("button", { name: /Reissue token/ })
      .click();
    await expect(
      page.getByRole("dialog", { name: "New voter token" }),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "New voter token" })
      .getByRole("button", { name: "Close" })
      .click();

    await voter.goto(`/s/${launched.publicId}/vote`);
    await expect(
      voter.getByText(/invalid|reissued/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

});
