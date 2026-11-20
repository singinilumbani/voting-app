import { z } from "zod";
import { apiFetch } from "./client";
import { publicStationResponseSchema } from "./schemas";
import { serverApiFetch } from "./server";

export const publicStationConfigApi = {
  get(publicId: string) {
    const id = z.string().min(1).parse(publicId);
    return apiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}`,
      publicStationResponseSchema,
    );
  },
  getServer(publicId: string) {
    const id = z.string().min(1).parse(publicId);
    const cacheOptions = {
      next: { revalidate: 30 },
    };
    return serverApiFetch(
      `/api/v1/public/stations/${encodeURIComponent(id)}`,
      publicStationResponseSchema,
      cacheOptions,
    );
  },
};
