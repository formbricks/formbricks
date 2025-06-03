"use server";

import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { updateProjectBranding } from "@/modules/ee/whitelabel/remove-branding/lib/project";
import { ZProjectUpdateBrandingInput } from "@/modules/ee/whitelabel/remove-branding/types/project";
import { getProject } from "@/modules/survey/editor/lib/project";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";

const ZUpdateProjectAction = z.object({
  projectId: ZId,
  data: ZProjectUpdateBrandingInput,
});

export const updateProjectBrandingAction = authenticatedActionClient.schema(ZUpdateProjectAction).action(
  withAuditLogging(
    "updated",
    "project",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
          throw new Error("Organization not found");
        }
        const canRemoveBranding = await getRemoveBrandingPermission(organization.billing.plan);

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
      ctx.auditLoggingCtx.oldObject = await getProject(parsedInput.projectId);
      const result = await updateProjectBranding(parsedInput.projectId, parsedInput.data);
      ctx.auditLoggingCtx.newObject = await getProject(parsedInput.projectId);
      return result;
    }
  )
);
