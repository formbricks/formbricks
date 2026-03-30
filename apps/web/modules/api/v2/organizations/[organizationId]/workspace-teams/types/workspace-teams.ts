import { z } from "zod";
import { ZWorkspaceTeam } from "@formbricks/database/zod/workspace-teams";
import { ZGetFilter } from "@/modules/api/v2/types/api-filter";

export const ZGetWorkspaceTeamsFilter = ZGetFilter.extend({
  teamId: z.cuid2().optional(),
  workspaceId: z.cuid2().optional(),
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

export type TGetWorkspaceTeamsFilter = z.infer<typeof ZGetWorkspaceTeamsFilter>;

export const ZWorkspaceTeamInput = ZWorkspaceTeam.pick({
  teamId: true,
  workspaceId: true,
  permission: true,
});

export type TWorkspaceTeamInput = z.infer<typeof ZWorkspaceTeamInput>;

export const ZGetWorkspaceTeamUpdateFilter = z.object({
  teamId: z.cuid2(),
  workspaceId: z.cuid2(),
});

export const ZWorkspaceZTeamUpdateSchema = ZWorkspaceTeam.pick({
  permission: true,
});
