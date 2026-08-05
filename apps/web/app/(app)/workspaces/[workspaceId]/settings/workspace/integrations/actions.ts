"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";
import { withStoredIntegrationKey } from "@/lib/integration/redact-credentials";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegrationByType,
} from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
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

      // `config.key` holds the provider's OAuth credentials, which the settings pages now redact before
      // handing the integration to a client component (lib/integration/redact-credentials.ts). The
      // mapping UI echoes the whole integration object back here on every add, edit *and* delete, so
      // trusting the `key` it sends would write those blanks straight over the stored tokens and
      // silently disconnect the integration — while the UI still rendered it as connected, because the
      // wrappers only test `config.key` for presence. The stored value is the sole source of truth on
      // this path; credentials are written only by the OAuth callbacks, which call
      // createOrUpdateIntegration directly rather than through this action.
      const storedIntegration = await getIntegrationByType(
        parsedInput.workspaceId,
        parsedInput.integrationData.type
      );
      const integrationData = withStoredIntegrationKey(parsedInput.integrationData, storedIntegration);

      const result = await createOrUpdateIntegration(parsedInput.workspaceId, integrationData);
      ctx.auditLoggingCtx.integrationId = result.id;
      ctx.auditLoggingCtx.newObject = result;

      capturePostHogEvent(
        ctx.user.id,
        "integration_connected",
        {
          integration_type: parsedInput.integrationData.type,
          organization_id: organizationId,
          workspace_id: parsedInput.workspaceId,
        },
        { organizationId, workspaceId: parsedInput.workspaceId }
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
