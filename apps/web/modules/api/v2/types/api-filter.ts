import { z } from "zod";

export const ZGetFilter = z.object({
  limit: z.coerce.number().min(1).max(250).optional().default(50).describe("Number of items to return"),
  skip: z.coerce.number().min(0).optional().default(0).describe("Number of items to skip"),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt").describe("Sort by field"),
  order: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
  startDate: z.coerce.date().optional().describe("Start date"),
  endDate: z.coerce.date().optional().describe("End date"),
});

export type TGetFilter = z.infer<typeof ZGetFilter>;
