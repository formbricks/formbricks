"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { createTeam } from "@/modules/ee/teams/team-list/lib/teams";
import { z } from "zod";

const ZCreateTeamAction = z.object({
  organizationId: z.string().cuid(),
  name: z.string(),
});

export const createTeamAction = authenticatedActionClient
  .schema(ZCreateTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });
    await checkRoleManagementPermission(parsedInput.organizationId);

    return await createTeam(parsedInput.organizationId, parsedInput.name);
  });
