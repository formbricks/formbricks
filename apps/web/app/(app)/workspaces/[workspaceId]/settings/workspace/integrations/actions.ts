"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";
import { assertCan } from "@/lib/authorization";
import { withStoredIntegrationKey } from "@/lib/integration/redact-credentials";
import {
  createOrUpdateIntegration,
  deleteIntegration,
  getIntegrationByType,
} from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import {
  getOrganizationIdFromIntegrationId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromIntegrationId,
} from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateOrUpdateIntegrationAction = z.object({
  workspaceId: ZId,
  integrationData: ZIntegrationInput,
});

export const createOrUpdateIntegrationAction = authenticatedActionClient
  .inputSchema(ZCreateOrUpdateIntegrationAction)
  .action(
    withAuditLogging("createdUpdated", "integration", async ({ ctx, parsedInput }) => {
      // Bound before any lookup: every call past this point reads the stored integration and writes the
      // provider config plus an audit-log entry.
      await applyRateLimit(rateLimitConfigs.actions.integrationMutation, ctx.user.id);

      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: parsedInput.workspaceId,
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

      // ENG-2292: only the id leaves this action. `result` is the full Prisma row, including the
      // `config.key` merged back in above — returning it would serialize the provider's access and
      // refresh tokens into the action response, for the same audience the settings pages redact them
      // from (readWrite workspace members). The callers only branch on success.
      return { id: result.id };
    })
  );

const ZDeleteIntegrationAction = z.object({
  integrationId: ZId,
});

export const deleteIntegrationAction = authenticatedActionClient.inputSchema(ZDeleteIntegrationAction).action(
  withAuditLogging("deleted", "integration", async ({ ctx, parsedInput }) => {
    // Same policy as the create/update path — a delete is the cheapest way to churn integration rows.
    await applyRateLimit(rateLimitConfigs.actions.integrationMutation, ctx.user.id);

    const organizationId = await getOrganizationIdFromIntegrationId(parsedInput.integrationId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: await getWorkspaceIdFromIntegrationId(parsedInput.integrationId),
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.integrationId = parsedInput.integrationId;
    const result = await deleteIntegration(parsedInput.integrationId);
    ctx.auditLoggingCtx.oldObject = result;

    // ENG-2292: the deleted row still carries the live OAuth credentials in `config.key`, so returning
    // it would hand a readWrite member the connecting user's tokens in one call — and the integration
    // can simply be reconnected afterwards. The callers only check that the delete succeeded.
    return { id: result.id };
  })
);
