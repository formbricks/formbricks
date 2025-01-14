import { type Insight } from "@prisma/client";
import { z } from "zod";

export const ZInsight = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
  title: z.string(),
  description: z.string(),
  category: z.enum(["featureRequest", "complaint", "praise", "other"]),
}) satisfies z.ZodType<Insight>;
