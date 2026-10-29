import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3TeamCreateBody, ZV3TeamDeleteInput, ZV3TeamUpdateFields } from "@/app/api/v3/teams/lib/schemas";

const teamIdField = ZId.describe("Team to act on. Take it from list_teams.");

/**
 * Input of `list_teams`. Without `teamId` it lists the organization's teams; with it, it reads that one team
 * in full, with its members and workspace access, which is what `update_team` needs to start from.
 */
export const ZMcpListTeamsInput = z
  .object({
    organizationId: ZId.describe("Organization whose teams to read. Take it from get_account_context."),
    teamId: ZId.optional().describe(
      "Read this one team with its members and workspace access instead of listing the organization's teams."
    ),
  })
  .strict();

export const ZMcpCreateTeamInput = ZV3TeamCreateBody.extend({
  organizationId: ZId.describe("Organization to create the team in. Take it from get_account_context."),
}).strict();

export const ZMcpUpdateTeamInput = ZV3TeamUpdateFields.extend({ teamId: teamIdField }).strict();

export const ZMcpDeleteTeamInput = ZV3TeamDeleteInput.extend({ teamId: teamIdField }).strict();

export type TMcpListTeamsInput = z.infer<typeof ZMcpListTeamsInput>;
export type TMcpCreateTeamInput = z.infer<typeof ZMcpCreateTeamInput>;
export type TMcpUpdateTeamInput = z.infer<typeof ZMcpUpdateTeamInput>;
export type TMcpDeleteTeamInput = z.infer<typeof ZMcpDeleteTeamInput>;
