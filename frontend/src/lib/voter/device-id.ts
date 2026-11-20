import { z } from "zod";

const deviceIdSchema = z.string().uuid();

const databaseName = "voting-app-device-ids";
const storeName = "deviceIds";

export function getDeviceStorageKey(publicId: string): string {
  return `voting-app:device:${encodeURIComponent(publicId)}`;
}

function cookieName(publicId: string): string {
  return `voting-app-device-${encodeURIComponent(publicId)}`;
}

function readLocal(publicId: string): string | null {
  try {
    const value = window.localStorage.getItem(getDeviceStorageKey(publicId));
    return deviceIdSchema.safeParse(value).success ? value : null;
  } catch {
    return null;
  }
}

function readCookie(publicId: string): string | null {
  try {
    const prefix = `${cookieName(publicId)}=`;
    const match = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(prefix));
    if (!match) return null;
    const value = decodeURIComponent(match.slice(prefix.length));
    return deviceIdSchema.safeParse(value).success ? value : null;
  } catch {
    return null;
  }
}

function openDeviceDatabase(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readIndexedDb(publicId: string): Promise<string | null> {
  const database = await openDeviceDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(publicId);
    request.onsuccess = () => {
      const value = request.result;
      resolve(deviceIdSchema.safeParse(value).success ? value : null);
      database.close();
    };
    request.onerror = () => {
      database.close();
      resolve(null);
    };
  });
}

async function writeIndexedDb(
  publicId: string,
  deviceId: string,
): Promise<void> {
  const database = await openDeviceDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(deviceId, publicId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      resolve();
    };
  });
}

function writeLocal(publicId: string, deviceId: string): void {
  try {
    window.localStorage.setItem(getDeviceStorageKey(publicId), deviceId);
  } catch {
    // Storage may be unavailable in privacy-focused browsers.
  }
}

function writeCookie(publicId: string, deviceId: string): void {
  try {
    document.cookie =
      `${cookieName(publicId)}=${encodeURIComponent(deviceId)}; ` +
      "Path=/; Max-Age=31536000; SameSite=Lax";
  } catch {
    // Cookies may be unavailable in privacy-focused browsers.
  }
}

export async function restoreDeviceId(publicId: string): Promise<string> {
  const localId = readLocal(publicId);
  const cookieId = readCookie(publicId);
  const indexedDbId = await readIndexedDb(publicId);
  const deviceId = chooseRestoredDeviceId(localId, cookieId, indexedDbId);

  writeLocal(publicId, deviceId);
  writeCookie(publicId, deviceId);
  await writeIndexedDb(publicId, deviceId);
  return deviceId;
}

export function chooseRestoredDeviceId(
  localId: string | null,
  cookieId: string | null,
  indexedDbId: string | null,
  generate: () => string = () => crypto.randomUUID(),
): string {
  return localId ?? cookieId ?? indexedDbId ?? generate();
}
