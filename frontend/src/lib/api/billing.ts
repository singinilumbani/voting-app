import { z } from "zod";
import { apiFetch } from "./client";

const billingStatusSchema = z.object({
  status: z.enum(["PENDING", "SUCCESSFUL", "FAILED"]),
});

export const billingApi = {
  status() {
    return apiFetch(
      "/api/v1/host/billing/status",
      billingStatusSchema,
    );
  },
};
