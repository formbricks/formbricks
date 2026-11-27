import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { PICKED_ITEMS_MAX } from "@/app/api/internal/lib/limits";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";
import { V3_REQUEST_ARRAY_MAX_ITEMS } from "@/app/api/v3/lib/array-budget";
import { TEAM_DASHBOARD_LIMIT_MAX } from "@/modules/ee/dashboard-access/lib/team-dashboard-limits";
import { TEAM_NAME_MAX, ZTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";

/** `/api/internal/teams?organizationId=`: the organization the teams are listed or created in. */
export const ZTeamsQuery = z.object({ organizationId: ZId }).strict();
export type TTeamsQuery = z.infer<typeof ZTeamsQuery>;

/** `/api/internal/teams/{teamId}` path. */
export const ZTeamIdParams = z.object({ teamId: ZId }).strict();

/** `POST /api/internal/teams` body: a new team starts with a name and nothing else. */
export const ZTeamCreateBody = z
  .object({ name: z.string().trim().min(1, "Team name is required").max(TEAM_NAME_MAX) })
  .strict();
export type TTeamCreateBody = z.infer<typeof ZTeamCreateBody>;

/**
 * `PATCH /api/internal/teams/{teamId}` body: the team settings form, whole. Members and workspace grants
 * are replaced by what is sent, so a client sends the full lists back, changed or not. The form's schema
 * strips unknown keys; this route-local copy rejects them in the list entries too.
 *
 * `dashboardIds`, when sent, replaces the team's dashboard limit (ENG-7483; empty = All dashboards) in the
 * transaction that writes the grants. Omitted, the limit is left as it is (bar workspaces the team loses).
 */
export const ZTeamUpdateBody = strictDeep(
  ZTeamSettingsFormSchema.extend({
    // A team can hold every member of a large organization, so members get the request-wide array cap.
    members: ZTeamSettingsFormSchema.shape.members.max(V3_REQUEST_ARRAY_MAX_ITEMS),
    workspaces: ZTeamSettingsFormSchema.shape.workspaces.max(PICKED_ITEMS_MAX),
    dashboardIds: z.array(z.cuid2()).max(TEAM_DASHBOARD_LIMIT_MAX).optional(),
  })
);
export type TTeamUpdateBody = z.infer<typeof ZTeamUpdateBody>;
