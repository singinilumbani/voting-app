import { z } from "zod";
import { STATION_LIMITS } from "@/lib/shared/station-constants";
import type { StationWizardDraft } from "./station-draft";

export const stationBasicsSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
  mode: z.enum(["PUBLIC_POLL", "CLOSED_VOTE"]),
  resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]),
  allowAbstain: z.boolean(),
  mobileOnly: z.boolean(),
});

export const registrationFormSchema = z.object({
  voterCap: z.coerce
    .number()
    .int()
    .min(STATION_LIMITS.registration.minimumVoters)
    .max(STATION_LIMITS.registration.maximumVoters),
  durationHours: z.coerce
    .number()
    .int()
    .min(STATION_LIMITS.registration.minimumDurationHours)
    .max(STATION_LIMITS.registration.maximumDurationHours),
});

const votingFormSchema = z.object({
  startMode: z.enum(["NOW", "SCHEDULED"]),
  startsAt: z.string(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(STATION_LIMITS.voting.minimumDurationMinutes)
    .max(STATION_LIMITS.voting.maximumDurationMinutes),
});

export type VotingConfiguration = Readonly<{
  startMode: "NOW" | "SCHEDULED";
  startsAt?: string;
  durationMinutes: number;
}>;

export function parseVotingConfiguration(
  draft: StationWizardDraft,
  now = new Date(),
): VotingConfiguration {
  const parsed = votingFormSchema.parse(draft.voting);
  if (parsed.startMode === "NOW") {
    return {
      startMode: "NOW",
      durationMinutes: parsed.durationMinutes,
    };
  }

  const startsAt = new Date(parsed.startsAt);
  const registrationClose =
    draft.basics.mode === "CLOSED_VOTE"
      ? new Date(
          now.getTime() +
            Number(draft.registration.durationHours) * 60 * 60 * 1000,
        )
      : now;
  const latestAllowed = new Date(
    registrationClose.getTime() +
      STATION_LIMITS.voting.maximumScheduledDays * 86_400_000,
  );
  if (
    Number.isNaN(startsAt.getTime()) ||
    startsAt < registrationClose ||
    startsAt > latestAllowed
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "station.validation.scheduledStart",
        path: ["startsAt"],
      },
    ]);
  }

  return {
    startMode: "SCHEDULED",
    startsAt: startsAt.toISOString(),
    durationMinutes: parsed.durationMinutes,
  };
}
