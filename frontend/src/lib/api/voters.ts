import { z } from "zod";
import { apiFetch, apiFetchText } from "./client";
import {
  emptyResponseSchema,
  voterActionSchema,
  voterIntegritySchema,
  voterTokenSchema,
  votersResponseSchema,
} from "./schemas";

const idSchema = z.string().min(1);
const voterQuerySchema = z.object({
  search: z.string().optional(),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "VOTED", "REVOKED"])
    .optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});
const bulkInputSchema = z.union([
  z.object({ voterIds: z.array(idSchema).min(1) }),
  z.object({
    allPending: z.literal(true),
    reason: z.string().optional(),
  }),
]);
const bulkApproveSchema = z.union([
  z.object({ voterIds: z.array(idSchema).min(1) }),
  z.object({ allPending: z.literal(true) }),
]);

function stationPath(stationId: string): string {
  return `/api/v1/host/stations/${encodeURIComponent(idSchema.parse(stationId))}`;
}

export const votersApi = {
  list(stationId: string, query: z.infer<typeof voterQuerySchema> = {}) {
    const filters = voterQuerySchema.parse(query);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.page !== undefined) params.set("page", String(filters.page));
    if (filters.pageSize !== undefined)
      params.set("pageSize", String(filters.pageSize));
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return apiFetch(
      `${stationPath(stationId)}/voters${suffix}`,
      votersResponseSchema,
    );
  },
  approve(stationId: string, voterId: string) {
    const voter = idSchema.parse(voterId);
    return apiFetch(
      `${stationPath(stationId)}/voters/${encodeURIComponent(voter)}/approve`,
      voterActionSchema,
      { method: "POST" },
    );
  },
  reject(stationId: string, voterId: string, reason?: string) {
    const voter = idSchema.parse(voterId);
    const body =
      reason === undefined
        ? undefined
        : z.object({ reason: z.string() }).parse({ reason });
    return apiFetch(
      `${stationPath(stationId)}/voters/${encodeURIComponent(voter)}/reject`,
      voterActionSchema,
      { method: "POST", body },
    );
  },
  bulkApprove(stationId: string, input: z.infer<typeof bulkApproveSchema>) {
    return apiFetch(
      `${stationPath(stationId)}/voters/bulk-approve`,
      z.object({ updatedCount: z.number() }),
      { method: "POST", body: bulkApproveSchema.parse(input) },
    );
  },
  bulkReject(stationId: string, input: z.infer<typeof bulkInputSchema>) {
    return apiFetch(
      `${stationPath(stationId)}/voters/bulk-reject`,
      z.object({ updatedCount: z.number() }),
      { method: "POST", body: bulkInputSchema.parse(input) },
    );
  },
  revoke(stationId: string, voterId: string) {
    const voter = idSchema.parse(voterId);
    return apiFetch(
      `${stationPath(stationId)}/voters/${encodeURIComponent(voter)}/revoke`,
      voterActionSchema,
      { method: "POST" },
    );
  },
  reissueToken(stationId: string, voterId: string) {
    const voter = idSchema.parse(voterId);
    return apiFetch(
      `${stationPath(stationId)}/voters/${encodeURIComponent(voter)}/reissue-token`,
      voterTokenSchema,
      { method: "POST" },
    );
  },
  blockNumber(stationId: string, voterId: string) {
    const voter = idSchema.parse(voterId);
    return apiFetch(
      `${stationPath(stationId)}/voters/${encodeURIComponent(voter)}/block-number`,
      emptyResponseSchema,
      { method: "POST" },
    );
  },
  integrity(stationId: string) {
    return apiFetch(
      `${stationPath(stationId)}/voters/integrity`,
      voterIntegritySchema,
    );
  },
  exportCsv(stationId: string) {
    return apiFetchText(`${stationPath(stationId)}/voters/export.csv`);
  },
};
