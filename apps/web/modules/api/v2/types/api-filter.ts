import { z } from "zod";

export const ZGetFilter = z.object({
  limit: z.coerce.number().positive().min(1).max(100).optional().default(10),
  skip: z.coerce.number().nonnegative().optional().default(0),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type TGetFilter = z.infer<typeof ZGetFilter>;
