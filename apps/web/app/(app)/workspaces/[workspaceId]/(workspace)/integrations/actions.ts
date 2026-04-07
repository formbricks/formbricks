"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";
import { createOrUpdateIntegration, deleteIntegration } from "@/lib/integration/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromIntegrationId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromIntegrationId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateOrUpdateIntegrationAction = z.object({
  workspaceId: ZId,
  integrationData: ZIntegrationInput,
});

export const createOrUpdateIntegrationAction = authenticatedActionClient
  .inputSchema(ZCreateOrUpdateIntegrationAction)
  .action(
    withAuditLogging("createdUpdated", "integration", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createOrUpdateIntegration(parsedInput.workspaceId, parsedInput.integrationData);
      ctx.auditLoggingCtx.integrationId = result.id;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    })
  );

const ZDeleteIntegrationAction = z.object({
  integrationId: ZId,
});

export const deleteIntegrationAction = authenticatedActionClient.inputSchema(ZDeleteIntegrationAction).action(
  withAuditLogging("deleted", "integration", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromIntegrationId(parsedInput.integrationId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: await getWorkspaceIdFromIntegrationId(parsedInput.integrationId),
          minPermission: "readWrite",
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.integrationId = parsedInput.integrationId;
    const result = await deleteIntegration(parsedInput.integrationId);
    ctx.auditLoggingCtx.oldObject = result;
    return result;
  })
);
