import { type Insight, InsightCategory } from "@prisma/client";
import { z } from "zod";

export const ZInsight = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
  title: z.string(),
  description: z.string(),
  category: z.nativeEnum(InsightCategory),
}) satisfies z.ZodType<Insight>;
