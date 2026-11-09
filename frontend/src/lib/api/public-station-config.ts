import { z } from "zod";
import { apiFetch } from "./client";
import { publicStationResponseSchema } from "./schemas";

export const publicStationConfigApi = {
  get(publicId: string) {
    const id = z.string().min(1).parse(publicId);
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}`,
      publicStationResponseSchema,
    );
  },
};
