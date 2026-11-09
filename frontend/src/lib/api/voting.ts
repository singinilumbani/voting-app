import { z } from "zod";
import { apiFetch } from "./client";
import {
  ballotEntrySchema,
  ballotSubmitSchema,
  registrationResponseSchema,
  voteResultsSchema,
  voterStatusSchema,
} from "./schemas";

const selectionsSchema = z.array(
  z.object({
    categoryId: z.string().uuid(),
    candidateId: z.union([z.string().uuid(), z.literal("ABSTAIN")]),
  }),
);
const publicIdSchema = z.string().min(1);

export const votingApi = {
  register(
    publicId: string,
    input: {
      fullName: string;
      phone: string;
      deviceUuid: string;
      fingerprintHash: string;
    },
  ) {
    const id = publicIdSchema.parse(publicId);
    const body = z
      .object({
        fullName: z.string().min(1),
        phone: z.string().min(1),
        deviceUuid: z.string().uuid(),
        fingerprintHash: z.string().min(1),
      })
      .parse(input);
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}/register`,
      registrationResponseSchema,
      { method: "POST", body },
    );
  },
  status(publicId: string, token: string) {
    const id = publicIdSchema.parse(publicId);
    const body = z.object({ token: z.string().min(1) }).parse({ token });
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}/status`,
      voterStatusSchema,
      { method: "POST", body },
    );
  },
  enterBallot(publicId: string, input: { token: string; phone?: string }) {
    const id = publicIdSchema.parse(publicId);
    const body = z
      .object({ token: z.string().min(1), phone: z.string().optional() })
      .parse(input);
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}/vote/enter`,
      ballotEntrySchema,
      { method: "POST", body },
    );
  },
  submitBallot(
    publicId: string,
    selections: z.infer<typeof selectionsSchema>,
    authorization?: string,
    publicPollDetails?: { deviceUuid: string; fingerprintHash: string },
  ) {
    const id = publicIdSchema.parse(publicId);
    const parsedSelections = selectionsSchema.parse(selections);
    const pollDetails = publicPollDetails
      ? z
          .object({
            deviceUuid: z.string().uuid(),
            fingerprintHash: z.string().min(1),
          })
          .parse(publicPollDetails)
      : undefined;
    const headers = new Headers();
    if (authorization) headers.set("Authorization", `Bearer ${authorization}`);
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}/vote/submit`,
      ballotSubmitSchema,
      {
        method: "POST",
        headers,
        body: { selections: parsedSelections, ...pollDetails },
      },
    );
  },
  results(publicId: string, resultsAccessToken?: string) {
    const id = publicIdSchema.parse(publicId);
    const headers = new Headers();
    if (resultsAccessToken) {
      headers.set(
        "Authorization",
        `Bearer ${z.string().min(1).parse(resultsAccessToken)}`,
      );
    }
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}/results`,
      voteResultsSchema,
      { headers },
    );
  },
};
