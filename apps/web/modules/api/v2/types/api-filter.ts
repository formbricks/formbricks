import { z } from "zod";

export const ZGetFilter = z.object({
  limit: z.coerce.number().min(1).max(250).optional().prefault(50).describe("Number of items to return"),
  skip: z.coerce.number().min(0).optional().prefault(0).describe("Number of items to skip"),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional().prefault("createdAt").describe("Sort by field"),
  order: z.enum(["asc", "desc"]).optional().prefault("desc").describe("Sort order"),
  startDate: z.coerce.date().optional().describe("Start date"),
  endDate: z.coerce.date().optional().describe("End date"),
  filterDateField: z.enum(["createdAt", "updatedAt"]).optional().describe("Date field to filter by"),
});

export type TGetFilter = z.infer<typeof ZGetFilter>;
