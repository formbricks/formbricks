"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/workspace/service";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getFeedbackDirectories } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const ZUpdateWorkspaceAction = z.object({
  workspaceId: ZId,
  data: ZWorkspaceUpdateInput,
});

export const updateWorkspaceAction = authenticatedActionClient.inputSchema(ZUpdateWorkspaceAction).action(
  withAuditLogging("updated", "workspace", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          schema: ZWorkspaceUpdateInput,
          data: parsedInput.data,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "manage",
        },
      ],
    });

    if (
      parsedInput.data.inAppSurveyBranding !== undefined ||
      parsedInput.data.linkSurveyBranding !== undefined
    ) {
      const organization = await getOrganization(organizationId);

      if (!organization) {
        throw new ResourceNotFoundError("Organization", organizationId);
      }

      const canRemoveBranding = await getRemoveBrandingPermission(organizationId);

      if (parsedInput.data.inAppSurveyBranding !== undefined) {
        if (!canRemoveBranding) {
          throw new OperationNotAllowedError("You are not allowed to remove in-app branding");
        }
      }

      if (parsedInput.data.linkSurveyBranding !== undefined) {
        if (!canRemoveBranding) {
          throw new OperationNotAllowedError("You are not allowed to remove link survey branding");
        }
      }
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.workspaceId = parsedInput.workspaceId;
    const oldObject = await getWorkspace(parsedInput.workspaceId);
    const result = await updateWorkspace(parsedInput.workspaceId, parsedInput.data);
    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZGetTeamsByOrganizationIdAction = z.object({
  organizationId: ZId,
});

export const getTeamsByOrganizationIdAction = authenticatedActionClient
  .inputSchema(ZGetTeamsByOrganizationIdAction)
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
    const teams = await getTeamsByOrganizationId(parsedInput.organizationId);
    return teams;
  });

const ZGetFeedbackDirectoriesByOrganizationIdAction = z.object({
  organizationId: ZId,
});

export const getFeedbackDirectoriesByOrganizationIdAction = authenticatedActionClient
  .inputSchema(ZGetFeedbackDirectoriesByOrganizationIdAction)
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

    const directories = await getFeedbackDirectories(parsedInput.organizationId);
    return directories.filter((directory) => !directory.isArchived).map(({ id, name }) => ({ id, name }));
  });
