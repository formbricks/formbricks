import { Insight } from "@prisma/client";
import { z } from "zod";
import { ZInsight } from "@formbricks/database/zod/insights";

export const ZInsightCreateInput = ZInsight.pick({
  environmentId: true,
  title: true,
  description: true,
  category: true,
}).extend({
  vector: z.array(z.number()).length(512),
});

export type TInsightCreateInput = z.infer<typeof ZInsightCreateInput>;

export type TNearestInsights = Pick<Insight, "id">;
