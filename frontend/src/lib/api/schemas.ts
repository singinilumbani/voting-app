import { z } from "zod";

export const hostDtoSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  accountType: z.enum(["TEMPORARY", "LONG_TERM"]),
  plan: z.string(),
  createdAt: z.string(),
  purgeAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});

export const hostResponseSchema = z.object({ host: hostDtoSchema });
export const profileUpdateResponseSchema = hostResponseSchema.extend({
  verificationRequired: z.boolean(),
});

export const authStatusSchema = z.object({ messageKey: z.string() });
export const emptyResponseSchema = z.undefined();

export const candidateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    imageUrl: z.string().url().nullable().optional(),
    picture: z.string().url().nullable().optional(),
  })
  .passthrough();

export const categorySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    candidates: z.array(candidateSchema).optional(),
  })
  .passthrough();

export const stationSchema = z
  .object({
    id: z.string().optional(),
    stationId: z.string().optional(),
    publicId: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    mode: z.enum(["PUBLIC_POLL", "CLOSED_VOTE"]),
    status: z.string(),
    regStartsAt: z.string().nullable().optional(),
    regEndsAt: z.string().nullable().optional(),
    voteStartsAt: z.string().nullable().optional(),
    voteEndsAt: z.string().nullable().optional(),
    mobileOnly: z.boolean().optional(),
    allowAbstain: z.boolean().optional(),
    resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]).optional(),
    categories: z.array(categorySchema).optional(),
  })
  .passthrough();

export const stationResponseSchema = z.object({
  station: stationSchema,
});

export const stationListSchema = z.object({
  stations: z.array(stationSchema),
});

export const publicStationResponseSchema = z.object({
  station: z
    .object({
      publicId: z.string(),
      name: z.string(),
      mode: z.enum(["PUBLIC_POLL", "CLOSED_VOTE"]),
      status: z.string(),
      regStartsAt: z.string().nullable(),
      regEndsAt: z.string().nullable(),
      voteStartsAt: z.string().nullable(),
      voteEndsAt: z.string().nullable(),
      mobileOnly: z.boolean(),
      allowAbstain: z.boolean(),
      resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]),
      categories: z.array(categorySchema).optional(),
    })
    .passthrough(),
});

export const voterSchema = z
  .object({
    id: z.string().optional(),
    voterId: z.string().optional(),
    fullName: z.string(),
    phone: z.string().optional(),
    status: z.string(),
    rejectionReason: z.string().nullable().optional(),
    flagReason: z.string().nullable().optional(),
    blocked: z.boolean().optional(),
    registeredAt: z.string().optional(),
    approvedAt: z.string().nullable().optional(),
    hasVoted: z.boolean().optional(),
    deviceFlag: z.string().nullable().optional(),
  })
  .passthrough();

export const votersResponseSchema = z.object({
  voters: z.array(voterSchema),
  counts: z.object({
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
    revoked: z.number(),
    voted: z.number(),
    cap: z.number(),
  }),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const analyticsSnapshotSchema = z
  .object({
    stationId: z.string(),
    stationName: z.string(),
    stationMode: z.enum(["CLOSED_VOTE", "PUBLIC_POLL"]),
    status: z.string(),
    state: z.enum(["WAITING", "LIVE", "FINAL"]),
    ballotsCast: z.number(),
    approvedVoters: z.number().nullable(),
    turnoutPercent: z.number().nullable(),
    possibleDuplicates: z.number(),
    timeRemainingSeconds: z.number().nullable(),
    categories: z.array(
      z.object({
        categoryId: z.string(),
        title: z.string(),
        candidates: z.array(
          z.object({
            candidateId: z.string(),
            name: z.string(),
            imageUrl: z.string().url().nullable(),
            count: z.number(),
            percentage: z.number(),
            isLeader: z.boolean(),
            isTie: z.boolean(),
          }),
        ),
        abstentions: z.number(),
      }),
    ),
    abstentions: z.number(),
    lastUpdated: z.string(),
  })
  .passthrough();

export const analyticsAuditSchema = z.object({
  events: z.array(
    z.object({
      voterId: z.string(),
      fullName: z.string(),
      checkedInAt: z.string(),
    }),
  ),
  limit: z.number(),
});

export const registrationResponseSchema = z.object({
  token: z.string(),
  status: z.string(),
});

export const voterStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVOKED"]),
  rejectionReason: z.string().optional(),
});

export const ballotEntrySchema = z.object({
  alreadyVoted: z.boolean(),
  ballotSession: z.string(),
  expiresAt: z.string(),
  ballot: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      candidates: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          imageUrl: z.string().url().nullable(),
        }),
      ),
    }),
  ),
});

export const ballotSubmitSchema = z.object({
  confirmation: z.string(),
  resultsAccessToken: z.string().optional(),
});

export const stationCategoryResponseSchema = z.object({
  category: categorySchema,
});
export const stationCategoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
});
export const candidateResponseSchema = z.object({
  candidate: candidateSchema,
});
export const launchStationResponseSchema = z.object({
  station: stationSchema,
  publicId: z.string(),
  shareLink: z.string().url(),
  warningKey: z.string().optional(),
});
export const registrationConfigResponseSchema = z.object({
  station: stationSchema,
  warningKey: z.string().optional(),
});
export const startVotingResponseSchema = z.discriminatedUnion(
  "requiresConfirmation",
  [
    z.object({
      requiresConfirmation: z.literal(true),
      warningKey: z.string(),
      pendingCount: z.number(),
    }),
    z.object({
      requiresConfirmation: z.literal(false),
      station: stationSchema,
      pendingCount: z.number(),
    }),
  ],
);
export const voterCountResponseSchema = z.object({ updatedCount: z.number() });
export const voterIntegritySchema = z.object({
  approvedVoters: z.number(),
  ballotsCast: z.number(),
  abstentions: z.number(),
  possibleDuplicates: z.number(),
  alert: z.boolean(),
});
export const voterActionSchema = z.object({
  voterId: z.string(),
  status: z.string(),
});
export const voterTokenSchema = z.object({ token: z.string() });
export const voterExportSchema = z.string();
export const voteResultsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    candidates: z.array(candidateSchema),
    results: z.array(
      z.object({
        candidateId: z.string(),
        count: z.number(),
      }),
    ),
  }),
);

export type HostDto = z.infer<typeof hostDtoSchema>;
export type StationDto = z.infer<typeof stationSchema>;
export type VoterDto = z.infer<typeof voterSchema>;
export type PublicStationDto = z.infer<typeof publicStationResponseSchema>;
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
