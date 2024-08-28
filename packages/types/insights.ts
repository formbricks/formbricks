import { z } from "zod";
import { ZId } from "./environment";

export const ZInsightCategory = z.enum(["enhancementRequest", "complaint", "praise"]);

export type TInsightCategory = z.infer<typeof ZInsightCategory>;

export const ZInsight = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: ZId,
  title: z.string(),
  description: z.string(),
  category: ZInsightCategory,
});

export type TInsight = z.infer<typeof ZInsight>;

export const ZInsightCreateInput = z.object({
  environmentId: ZId,
  title: z.string(),
  description: z.string(),
  category: ZInsightCategory,
  vector: z.array(z.number()).length(512),
});

export type TInsightCreateInput = z.infer<typeof ZInsightCreateInput>;
