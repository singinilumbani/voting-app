"use client";

import { z } from "zod";

export type BallotSelections = Record<string, string>;

const selectionsSchema = z.record(z.string(), z.string());

function draftKey(publicId: string): string {
  return `voting-app:ballot-draft:${encodeURIComponent(publicId)}`;
}

function sessionKey(publicId: string): string {
  return `voting-app:ballot-session:${encodeURIComponent(publicId)}`;
}

export function readBallotDraft(publicId: string): BallotSelections {
  try {
    const parsed = selectionsSchema.safeParse(
      JSON.parse(window.localStorage.getItem(draftKey(publicId)) ?? "{}"),
    );
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function storeBallotDraft(
  publicId: string,
  selections: BallotSelections,
): void {
  try {
    window.localStorage.setItem(
      draftKey(publicId),
      JSON.stringify(selectionsSchema.parse(selections)),
    );
  } catch {
    // Storage may be unavailable in privacy-focused browsers.
  }
}

export function clearBallotDraft(publicId: string): void {
  try {
    window.localStorage.removeItem(draftKey(publicId));
  } catch {
    // Storage may be unavailable in privacy-focused browsers.
  }
}

export function storeBallotSession(
  publicId: string,
  ballotSession: string,
  expiresAt: string,
): void {
  try {
    window.sessionStorage.setItem(
      sessionKey(publicId),
      JSON.stringify({ ballotSession, expiresAt }),
    );
  } catch {
    // Session storage may be unavailable in privacy-focused browsers.
  }
}

export function readBallotSession(publicId: string):
  | Readonly<{ ballotSession: string; expiresAt: string }>
  | null {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(sessionKey(publicId)) ?? "null",
    );
    const parsed = z
      .object({ ballotSession: z.string(), expiresAt: z.string() })
      .safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearBallotSession(publicId: string): void {
  try {
    window.sessionStorage.removeItem(sessionKey(publicId));
  } catch {
    // Session storage may be unavailable in privacy-focused browsers.
  }
}

export function storeResultsAccessToken(
  publicId: string,
  accessToken: string,
): void {
  try {
    window.sessionStorage.setItem(
      `voting-app:results-access:${encodeURIComponent(publicId)}`,
      accessToken,
    );
  } catch {
    // Session storage may be unavailable in privacy-focused browsers.
  }
}

export function readResultsAccessToken(publicId: string): string | null {
  try {
    return window.sessionStorage.getItem(
      `voting-app:results-access:${encodeURIComponent(publicId)}`,
    );
  } catch {
    return null;
  }
}

