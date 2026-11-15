import { z } from "zod";

export const stationDraftStorageKey = "voting-app:station-wizard-draft";
export const stationDraftChangedEvent = "vote:station-draft-changed";

const stationDraftSchema = z.object({
  stationId: z.string().min(1).optional(),
  step: z.number().int().min(0).max(4),
  basics: z.object({
    name: z.string(),
    description: z.string(),
    mode: z.enum(["PUBLIC_POLL", "CLOSED_VOTE"]),
    resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]),
    allowAbstain: z.boolean(),
    mobileOnly: z.boolean(),
  }),
  registration: z.object({
    voterCap: z.string(),
    durationHours: z.string(),
  }),
  voting: z.object({
    startMode: z.enum(["NOW", "SCHEDULED"]),
    startsAt: z.string(),
    durationMinutes: z.string(),
  }),
  pendingCategoryTitle: z.string(),
  pendingCategoryId: z.string().optional(),
  pendingCandidate: z
    .object({
      categoryId: z.string(),
      candidateId: z.string().optional(),
      name: z.string(),
      imageUrl: z.string().url().optional(),
      imageDataUrl: z.string().optional(),
    })
    .nullable(),
});

export type StationWizardDraft = z.infer<typeof stationDraftSchema>;

export function parseStationDraft(saved: string): StationWizardDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error("station.draft.invalid");
  }
  return stationDraftSchema.parse(parsed);
}

export function readStationDraft(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): StationWizardDraft | null {
  const saved = storage.getItem(stationDraftStorageKey);
  if (saved === null) return null;

  return parseStationDraft(saved);
}

export function saveStationDraft(
  draft: StationWizardDraft,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  const validatedDraft = stationDraftSchema.parse(draft);
  storage.setItem(stationDraftStorageKey, JSON.stringify(validatedDraft));
  notifyDraftChange(storage);
}

export function discardStationDraft(
  storage: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  storage.removeItem(stationDraftStorageKey);
  notifyDraftChange(storage);
}

function notifyDraftChange(storage: object): void {
  if (
    typeof window !== "undefined" &&
    storage === window.localStorage
  ) {
    window.dispatchEvent(new Event(stationDraftChangedEvent));
  }
}
