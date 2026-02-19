import { z } from "zod";
import { ZGetFilter } from "@/modules/api/v2/types/api-filter";

export const ZDashboardInput = z.object({
  projectId: z.string().cuid2(),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export type TDashboardInput = z.infer<typeof ZDashboardInput>;

export const ZGetDashboardsFilter = ZGetFilter.extend({
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

export type TGetDashboardsFilter = z.infer<typeof ZGetDashboardsFilter>;
