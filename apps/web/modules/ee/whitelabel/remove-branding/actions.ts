"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { updateProjectBranding } from "@/modules/ee/whitelabel/remove-branding/lib/project";
import { ZProjectUpdateBrandingInput } from "@/modules/ee/whitelabel/remove-branding/types/project";
import { getProject } from "@/modules/survey/editor/lib/project";

const ZUpdateProjectAction = z.object({
  projectId: ZId,
  data: ZProjectUpdateBrandingInput,
});

export const updateProjectBrandingAction = authenticatedActionClient.inputSchema(ZUpdateProjectAction).action(
  withAuditLogging("updated", "project", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

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
          projectId: parsedInput.projectId,
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
    ctx.auditLoggingCtx.projectId = parsedInput.projectId;
    const oldProject = await getProject(parsedInput.projectId);
    ctx.auditLoggingCtx.oldObject = oldProject;
    const result = await updateProjectBranding(parsedInput.projectId, parsedInput.data);
    ctx.auditLoggingCtx.newObject = await getProject(parsedInput.projectId);

    const groupContext = { organizationId, workspaceId: parsedInput.projectId };

    if (oldProject?.linkSurveyBranding === true && parsedInput.data.linkSurveyBranding === false) {
      capturePostHogEvent(
        ctx.user.id,
        "remove_branding_enabled",
        {
          organization_id: organizationId,
          workspace_id: parsedInput.projectId,
          branding_type: "link",
        },
        groupContext
      );
    }

    if (oldProject?.inAppSurveyBranding === true && parsedInput.data.inAppSurveyBranding === false) {
      capturePostHogEvent(
        ctx.user.id,
        "remove_branding_enabled",
        {
          organization_id: organizationId,
          workspace_id: parsedInput.projectId,
          branding_type: "in_app",
        },
        groupContext
      );
    }

    return result;
  })
);
