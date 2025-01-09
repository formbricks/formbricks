import { type Insight, InsightCategory } from "@prisma/client";
import { z } from "zod";
import { ZId } from "../../types/common";

export const ZInsightCategory = z.nativeEnum(InsightCategory);

const InsightModel = z.object({
  id: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: ZId,
  title: z.string(),
  description: z.string(),
  category: ZInsightCategory,
}) satisfies z.ZodType<Insight>;

export const ZInsight = InsightModel.extend({
  _count: z.object({
    documentInsights: z.number(),
  }),
});

export type TInsight = z.infer<typeof ZInsight>;

export const ZInsightCreateInput = InsightModel.pick({
  environmentId: true,
  title: true,
  description: true,
  category: true,
}).extend({
  vector: z.array(z.number()).length(512),
});

export type TInsightCreateInput = z.infer<typeof ZInsightCreateInput>;

export const ZInsightFilterCriteria = z.object({
  documentCreatedAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),
  category: ZInsightCategory.optional(),
});

export type TInsightFilterCriteria = z.infer<typeof ZInsightFilterCriteria>;
