import { z } from "zod";

/**
 * Input schemas for the read-only access settings tools (ENG-7479). Each maps onto one v3 operation
 * (`GET /api/v3/teams/{teamId}/dashboard-limits`, `GET /api/v3/feedback-datasets/{datasetId}/
 * dashboard-viewer-access`), which owns access and validation; these give an agent the shape and reject
 * unknown keys.
 */

export const ZMcpGetTeamDashboardLimitsInput = z.strictObject({
  teamId: z.cuid2().describe("Team ID whose dashboard limits to read."),
});
export type TMcpGetTeamDashboardLimitsInput = z.infer<typeof ZMcpGetTeamDashboardLimitsInput>;

export const ZMcpGetDashboardViewerAccessInput = z.strictObject({
  datasetId: z
    .cuid2()
    .describe("Feedback Dataset ID (from list_feedback_datasets) whose Dashboard Viewer access to read."),
});
export type TMcpGetDashboardViewerAccessInput = z.infer<typeof ZMcpGetDashboardViewerAccessInput>;
