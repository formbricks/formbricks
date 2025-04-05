import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";
import { ZProjectTeam } from "@formbricks/database/zod/project-teams";

export const ZGetProjectTeamsFilter = ZGetFilter.extend({
  teamId: z.string().cuid2(),
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

export type TGetProjectTeamsFilter = z.infer<typeof ZGetProjectTeamsFilter>;

export const ZProjectTeamInput = ZProjectTeam.pick({
  teamId: true,
  projectId: true,
  permission: true,
});

export type TProjectTeamInput = z.infer<typeof ZProjectTeamInput>;

export const ZGetProjectTeamUpdateFilter = z.object({
  teamId: z.string().cuid2(),
  projectId: z.string().cuid2(),
});

export const ZProjectZTeamUpdateSchema = ZProjectTeam.pick({
  permission: true,
});
