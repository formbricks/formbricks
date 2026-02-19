import { ChartType } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/dashboard";

extendZodWithOpenApi(z);

export const ZChartIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "chartId",
    description: "The ID of the chart",
    param: {
      name: "id",
      in: "path",
    },
  });

export const ZChartUpdateInput = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    type: z.nativeEnum(ChartType).optional(),
    query: ZChartQuery.optional(),
    config: ZChartConfig.optional(),
  })
  .openapi({
    ref: "chartUpdate",
    description: "The fields to update on a chart.",
  });

export type TChartUpdateInput = z.infer<typeof ZChartUpdateInput>;
