"use server";

import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { getOrganization } from "@/lib/organization/service";
import { getProject } from "@/lib/project/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { updateProject } from "@/modules/projects/settings/lib/project";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProjectUpdateInput } from "@formbricks/types/project";

const ZUpdateProjectAction = z.object({
  projectId: ZId,
  data: ZProjectUpdateInput,
});

export const updateProjectAction = authenticatedActionClient.schema(ZUpdateProjectAction).action(
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
            schema: ZProjectUpdateInput,
            data: parsedInput.data,
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
      const oldObject = await getProject(parsedInput.projectId);
      const result = await updateProject(parsedInput.projectId, parsedInput.data);
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

const ZGetTeamsByOrganizationIdAction = z.object({
  organizationId: ZId,
});

export const getTeamsByOrganizationIdAction = authenticatedActionClient
  .schema(ZGetTeamsByOrganizationIdAction)
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
