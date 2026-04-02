"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { getSlackChannels } from "@/lib/slack/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromEnvironmentId } from "@/lib/utils/helper";

const ZGetSlackChannelsAction = z.object({
  environmentId: ZId,
});

export const getSlackChannelsAction = authenticatedActionClient
  .inputSchema(ZGetSlackChannelsAction)
  .action(async ({ ctx, parsedInput }) => {
    const workspaceId = await getWorkspaceIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWorkspaceId(workspaceId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId,
          minPermission: "readWrite",
        },
      ],
    });

    return await getSlackChannels(parsedInput.environmentId);
  });
