import { apiFetch, apiFetchText } from "./client";
import { analyticsAuditSchema, analyticsSnapshotSchema } from "./schemas";
import { z } from "zod";

const stationIdSchema = z.string().min(1);

export const analyticsApi = {
  snapshot(stationId: string) {
    const id = stationIdSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/analytics/snapshot`,
      analyticsSnapshotSchema,
    );
  },
  audit(stationId: string) {
    const id = stationIdSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/analytics/audit`,
      analyticsAuditSchema,
    );
  },
  exportCsv(stationId: string) {
    const id = stationIdSchema.parse(stationId);
    return apiFetchText(
      `/api/v1/host/stations/${encodeURIComponent(id)}/analytics/export.csv`,
    );
  },
};
