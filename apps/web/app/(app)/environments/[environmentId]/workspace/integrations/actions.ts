"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";
import { createOrUpdateIntegration, deleteIntegration } from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromIntegrationId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromIntegrationId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateOrUpdateIntegrationAction = z.object({
  environmentId: ZId,
  integrationData: ZIntegrationInput,
});

export const createOrUpdateIntegrationAction = authenticatedActionClient
  .inputSchema(ZCreateOrUpdateIntegrationAction)
  .action(
    withAuditLogging("createdUpdated", "integration", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);
      const result = await createOrUpdateIntegration(parsedInput.environmentId, parsedInput.integrationData);
      ctx.auditLoggingCtx.integrationId = result.id;
      ctx.auditLoggingCtx.newObject = result;

      capturePostHogEvent(
        ctx.user.id,
        "integration_connected",
        {
          integration_type: parsedInput.integrationData.type,
          organization_id: organizationId,
          workspace_id: projectId,
          environment_id: parsedInput.environmentId,
        },
        { organizationId, workspaceId: projectId }
      );

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
          type: "projectTeam",
          projectId: await getProjectIdFromIntegrationId(parsedInput.integrationId),
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
