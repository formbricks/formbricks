import { z } from "zod";
import { ZWorkspaceTeam } from "@formbricks/database/zod/workspace-teams";
import { ZGetFilter } from "@/modules/api/v2/types/api-filter";

// Backwards compatibility: accept `projectId` as alias for `workspaceId`
export const ZGetWorkspaceTeamsFilter = ZGetFilter.extend({
  teamId: z.cuid2().optional(),
  workspaceId: z.cuid2().optional(),
  projectId: z.cuid2().optional(), // legacy alias for workspaceId
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

// Backwards compatibility: accept `projectId` as alias for `workspaceId`
export const ZWorkspaceTeamInput = ZWorkspaceTeam.pick({
  teamId: true,
  workspaceId: true,
  permission: true,
}).extend({
  workspaceId: z.cuid2().optional(),
  projectId: z.cuid2().optional(), // legacy alias for workspaceId
});

export type TWorkspaceTeamInput = z.infer<typeof ZWorkspaceTeamInput>;

// Backwards compatibility: accept `projectId` as alias for `workspaceId`
export const ZGetWorkspaceTeamUpdateFilter = z.object({
  teamId: z.cuid2(),
  workspaceId: z.cuid2().optional(),
  projectId: z.cuid2().optional(), // legacy alias for workspaceId
});

export const ZWorkspaceZTeamUpdateSchema = ZWorkspaceTeam.pick({
  permission: true,
});
