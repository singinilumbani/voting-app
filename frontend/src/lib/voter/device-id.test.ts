import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseRestoredDeviceId,
  getDeviceStorageKey,
  restoreDeviceId,
} from "./device-id";

describe("restoreDeviceId", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "voting-app-device-station-one=; Path=/; Max-Age=0";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores and repairs storage from localStorage", async () => {
    const deviceId = "00000000-0000-4000-8000-000000000123";
    window.localStorage.setItem(getDeviceStorageKey("station-one"), deviceId);

    await expect(restoreDeviceId("station-one")).resolves.toBe(deviceId);
    expect(
      document.cookie.includes(`voting-app-device-station-one=${deviceId}`),
    ).toBe(true);
  });

  it("restores from the first-party cookie", async () => {
    const deviceId = "00000000-0000-4000-8000-000000000124";
    document.cookie = `voting-app-device-station-one=${deviceId}; Path=/; SameSite=Lax`;

    await expect(restoreDeviceId("station-one")).resolves.toBe(deviceId);
    expect(
      window.localStorage.getItem(getDeviceStorageKey("station-one")),
    ).toBe(deviceId);
  });

  it("restores from each surviving storage layer", () => {
    const localId = "00000000-0000-4000-8000-000000000126";
    const cookieId = "00000000-0000-4000-8000-000000000127";
    const indexedDbId = "00000000-0000-4000-8000-000000000128";
    expect(chooseRestoredDeviceId(localId, cookieId, indexedDbId)).toBe(
      localId,
    );
    expect(chooseRestoredDeviceId(null, cookieId, indexedDbId)).toBe(cookieId);
    expect(chooseRestoredDeviceId(null, null, indexedDbId)).toBe(indexedDbId);
  });

  it("creates and persists a UUID when no surviving layer exists", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000125",
    );

    const deviceId = await restoreDeviceId("station-one");
    expect(deviceId).toBe("00000000-0000-4000-8000-000000000125");
    expect(
      window.localStorage.getItem(getDeviceStorageKey("station-one")),
    ).toBe(deviceId);
  });
});
