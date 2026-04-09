"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getUserWorkspaces, getWorkspace } from "@/lib/workspace/service";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { deleteWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const ZWorkspaceDeleteAction = z.object({
  workspaceId: ZId,
});

export const deleteWorkspaceAction = authenticatedActionClient.inputSchema(ZWorkspaceDeleteAction).action(
  withAuditLogging("deleted", "workspace", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const availableWorkspaces = (await getUserWorkspaces(ctx.user.id, organizationId)) ?? null;

    if (!!availableWorkspaces && availableWorkspaces?.length <= 1) {
      throw new Error("You can't delete the last workspace in the environment.");
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.workspaceId = parsedInput.workspaceId;
    ctx.auditLoggingCtx.oldObject = await getWorkspace(parsedInput.workspaceId);

    // delete workspace
    return await deleteWorkspace(parsedInput.workspaceId);
  })
);
