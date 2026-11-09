import { z } from "zod";
import { apiFetch } from "./client";
import {
  candidateResponseSchema,
  launchStationResponseSchema,
  registrationConfigResponseSchema,
  startVotingResponseSchema,
  stationCategoriesResponseSchema,
  stationCategoryResponseSchema,
  stationListSchema,
  stationResponseSchema,
  type StationDto,
} from "./schemas";

const idSchema = z.string().min(1);
const stationCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  mode: z.enum(["PUBLIC_POLL", "CLOSED_VOTE"]),
  resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]).optional(),
  allowAbstain: z.boolean(),
  mobileOnly: z.boolean(),
});
const stationUpdateSchema = stationCreateSchema
  .partial()
  .omit({ mode: true })
  .refine((value) => Object.keys(value).length > 0);
const categoryInputSchema = z.object({ title: z.string().min(1) });
const candidateInputSchema = z.object({
  name: z.string().min(1),
  picture: z.string().url().nullable().optional(),
});
const candidateUpdateSchema = candidateInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
const registrationConfigSchema = z.object({
  voterCap: z.number().int().min(2).max(50_000),
  durationHours: z.number().int().min(1).max(24).optional(),
});
const votingConfigSchema = z.object({
  startMode: z.enum(["NOW", "SCHEDULED"]),
  startsAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
});

export type StationCreateInput = z.infer<typeof stationCreateSchema>;

export const stationsApi = {
  list(
    filters: {
      filter?: "All" | "Active" | "Scheduled" | "Past";
      search?: string;
    } = {},
  ): Promise<{ stations: StationDto[] }> {
    const query = new URLSearchParams();
    if (filters.filter) query.set("filter", filters.filter);
    if (filters.search) query.set("search", filters.search);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return apiFetch(`/api/v1/host/stations${suffix}`, stationListSchema);
  },
  get(stationId: string): Promise<{ station: StationDto }> {
    const id = idSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}`,
      stationResponseSchema,
    );
  },
  create(input: StationCreateInput): Promise<{ station: StationDto }> {
    return apiFetch("/api/v1/host/stations", stationResponseSchema, {
      method: "POST",
      body: stationCreateSchema.parse(input),
    });
  },
  update(stationId: string, input: z.infer<typeof stationUpdateSchema>) {
    const id = idSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}`,
      stationResponseSchema,
      { method: "PATCH", body: stationUpdateSchema.parse(input) },
    );
  },
  createCategory(stationId: string, title: string) {
    const id = idSchema.parse(stationId);
    const body = categoryInputSchema.parse({ title });
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/categories`,
      stationCategoryResponseSchema,
      { method: "POST", body },
    );
  },
  updateCategory(stationId: string, categoryId: string, title: string) {
    const id = idSchema.parse(stationId);
    const category = idSchema.parse(categoryId);
    const body = categoryInputSchema.parse({ title });
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/categories/${encodeURIComponent(category)}`,
      stationCategoryResponseSchema,
      { method: "PATCH", body },
    );
  },
  orderCategories(stationId: string, categoryIds: string[]) {
    const id = idSchema.parse(stationId);
    const body = z
      .object({ categoryIds: z.array(idSchema) })
      .parse({ categoryIds });
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/categories/order`,
      stationCategoriesResponseSchema,
      { method: "PUT", body },
    );
  },
  deleteCategory(stationId: string, categoryId: string) {
    const id = idSchema.parse(stationId);
    const category = idSchema.parse(categoryId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/categories/${encodeURIComponent(category)}`,
      z.undefined(),
      { method: "DELETE" },
    );
  },
  createCandidate(
    stationId: string,
    categoryId: string,
    input: z.infer<typeof candidateInputSchema>,
  ) {
    const id = idSchema.parse(stationId);
    const category = idSchema.parse(categoryId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/categories/${encodeURIComponent(category)}/candidates`,
      candidateResponseSchema,
      { method: "POST", body: candidateInputSchema.parse(input) },
    );
  },
  updateCandidate(
    stationId: string,
    candidateId: string,
    input: z.infer<typeof candidateUpdateSchema>,
  ) {
    const id = idSchema.parse(stationId);
    const candidate = idSchema.parse(candidateId);
    const body = candidateUpdateSchema.parse(input);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/candidates/${encodeURIComponent(candidate)}`,
      candidateResponseSchema,
      { method: "PATCH", body },
    );
  },
  deleteCandidate(stationId: string, candidateId: string) {
    const id = idSchema.parse(stationId);
    const candidate = idSchema.parse(candidateId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/candidates/${encodeURIComponent(candidate)}`,
      z.undefined(),
      { method: "DELETE" },
    );
  },
  configureRegistration(
    stationId: string,
    input: z.infer<typeof registrationConfigSchema>,
  ) {
    const id = idSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/registration-config`,
      registrationConfigResponseSchema,
      { method: "PUT", body: registrationConfigSchema.parse(input) },
    );
  },
  configureVoting(
    stationId: string,
    input: z.infer<typeof votingConfigSchema>,
  ) {
    const id = idSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/voting-config`,
      stationResponseSchema,
      { method: "PUT", body: votingConfigSchema.parse(input) },
    );
  },
  launch(stationId: string) {
    const id = idSchema.parse(stationId);
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/launch`,
      launchStationResponseSchema,
      { method: "POST" },
    );
  },
  startVoting(stationId: string, confirm = false) {
    const id = idSchema.parse(stationId);
    const body = confirm ? { confirm: z.literal(true).parse(confirm) } : {};
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/start-voting`,
      startVotingResponseSchema,
      { method: "POST", body },
    );
  },
  cancel(stationId: string, confirm?: "CANCEL") {
    const id = idSchema.parse(stationId);
    const body = z.object({ confirm: z.literal("CANCEL").optional() }).parse({
      confirm,
    });
    return apiFetch(
      `/api/v1/host/stations/${encodeURIComponent(id)}/cancel`,
      stationResponseSchema,
      { method: "POST", body },
    );
  },
};
