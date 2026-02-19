import { ChartType } from "@prisma/client";
import { z } from "zod";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/dashboard";
import { ZGetFilter } from "@/modules/api/v2/types/api-filter";

export const ZChartInput = z.object({
  projectId: z.string().cuid2(),
  name: z.string().trim().min(1).max(255),
  type: z.nativeEnum(ChartType),
  query: ZChartQuery,
  config: ZChartConfig.optional().default({}),
});

export type TChartInput = z.infer<typeof ZChartInput>;

export const ZGetChartsFilter = ZGetFilter.extend({
  projectId: z.string().cuid2().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return false;
    }
    return true;
  },
  {
    message: "startDate must be before endDate",
  }
);

export type TGetChartsFilter = z.infer<typeof ZGetChartsFilter>;
