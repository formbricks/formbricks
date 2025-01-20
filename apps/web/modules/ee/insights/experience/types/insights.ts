import { Insight } from "@prisma/client";
import { z } from "zod";
import { ZInsight } from "@formbricks/database/zod/insights";

export const ZInsightFilterCriteria = z.object({
  documentCreatedAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),
  category: ZInsight.shape.category.optional(),
});

export type TInsightFilterCriteria = z.infer<typeof ZInsightFilterCriteria>;

export interface TInsightWithDocumentCount extends Insight {
  _count: {
    documentInsights: number;
  };
}
