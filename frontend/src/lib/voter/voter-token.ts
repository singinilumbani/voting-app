"use client";

import { z } from "zod";

const voterTokenSchema = z.string().min(1);

export function getVoterTokenStorageKey(publicId: string): string {
  return `voting-app:voter-token:${encodeURIComponent(publicId)}`;
}

export function readVoterToken(publicId: string): string | null {
  try {
    const value = window.localStorage.getItem(getVoterTokenStorageKey(publicId));
    const parsed = voterTokenSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function storeVoterToken(publicId: string, token: string): void {
  const parsed = voterTokenSchema.parse(token);
  try {
    window.localStorage.setItem(
      getVoterTokenStorageKey(publicId),
      parsed,
    );
  } catch {
    // Storage may be unavailable in privacy-focused browsers.
  }
}

