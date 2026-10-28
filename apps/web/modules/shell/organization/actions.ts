"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { assertCan } from "@/lib/authorization";
import { deleteOrganization, getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled, getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

/*
 * Relocated, not new: these two actions moved here from the old `(app)` tree (`createWorkspaceAction` from
 * `app/(app)/workspaces/[workspaceId]/actions.ts`, `deleteOrganizationAction` from
 * `app/(app)/workspaces/[workspaceId]/settings/organization/general/actions.ts`) so the organization pages
 * keep working once that tree is deleted. The service calls, authorization and audit logging are unchanged.
 */

const ZCreateWorkspaceAction = z.object({
  organizationId: ZId,
  data: ZWorkspaceUpdateInput.pick({ name: true }),
});

export const createWorkspaceAction = authenticatedActionClient.inputSchema(ZCreateWorkspaceAction).action(
  withAuditLogging("created", "workspace", async ({ ctx, parsedInput }) => {
    const { user } = ctx;
    const organizationId = parsedInput.organizationId;

    await assertCan({ type: "user", id: user.id }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
    // Defence in depth for ENG-3921: bounds how wide a burst can be. The lock inside `createWorkspace` is
    // what enforces the cap.
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    const organization = await getOrganization(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const [workspaceLimit, workspaceCount] = await Promise.all([
      getOrganizationWorkspacesLimit(organization.id),
      getOrganizationWorkspacesCount(organization.id),
    ]);

    // A fast path for the common case; `createWorkspace` checks again under a lock (ENG-3921).
    if (workspaceCount >= workspaceLimit) {
      throw new OperationNotAllowedError("Organization workspace limit reached");
    }

    const workspace = await createWorkspace(organizationId, parsedInput.data, { workspaceLimit });

    groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });
    capturePostHogEvent(
      user.id,
      "workspace_created",
      {
        organization_id: organizationId,
        workspace_id: workspace.id,
        name: workspace.name,
      },
      { organizationId, workspaceId: workspace.id }
    );

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.workspaceId = workspace.id;
    ctx.auditLoggingCtx.newObject = workspace;
    return workspace;
  })
);

const ZDeleteOrganizationAction = z.object({
  organizationId: ZId,
});

export const deleteOrganizationAction = authenticatedActionClient
  .inputSchema(ZDeleteOrganizationAction)
  .action(
    withAuditLogging("deleted", "organization", async ({ ctx, parsedInput }) => {
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      if (!isMultiOrgEnabled) {
        const t = await getTranslate(ctx.user.locale);
        throw new OperationNotAllowedError(t("workspace.settings.general.organization_deletion_disabled"));
      }

      await assertCan({ type: "user", id: ctx.user.id }, "organization.write", {
        type: "organization",
        id: parsedInput.organizationId,
      });
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      const oldObject = await getOrganization(parsedInput.organizationId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      return await deleteOrganization(parsedInput.organizationId);
    })
  );
