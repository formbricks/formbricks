import { z } from "zod";
import { TEAM_DASHBOARD_LIMIT_MAX } from "@/modules/ee/dashboard-access/lib/team-dashboard-limits";

/**
 * Request schemas of a team's dashboard limits (ENG-7483), hand-written beside the spec
 * (`docs/api-v3-reference/src/paths/api_v3_teams_{teamId}_dashboard-limits.yml`).
 */

export const ZV3TeamParams = z.strictObject({ teamId: z.cuid2() });

export const ZV3TeamDashboardLimitsBody = z.strictObject({
  dashboardIds: z.array(z.cuid2()).max(TEAM_DASHBOARD_LIMIT_MAX),
});
export type TV3TeamDashboardLimitsBody = z.infer<typeof ZV3TeamDashboardLimitsBody>;
