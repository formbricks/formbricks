"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { updateWorkspaceBranding } from "@/modules/ee/whitelabel/remove-branding/lib/workspace";
import { ZWorkspaceUpdateBrandingInput } from "@/modules/ee/whitelabel/remove-branding/types/workspace";
import { getWorkspace } from "@/modules/survey/editor/lib/workspace";

const ZUpdateWorkspaceAction = z.object({
  workspaceId: ZId,
  data: ZWorkspaceUpdateBrandingInput,
});

export const updateWorkspaceBrandingAction = authenticatedActionClient
  .inputSchema(ZUpdateWorkspaceAction)
  .action(
    withAuditLogging("updated", "workspace", async ({ ctx, parsedInput }) => {
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
          throw new Error("Organization not found");
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
      ctx.auditLoggingCtx.oldObject = await getWorkspace(parsedInput.workspaceId);
      const result = await updateWorkspaceBranding(parsedInput.workspaceId, parsedInput.data);
      ctx.auditLoggingCtx.newObject = await getWorkspace(parsedInput.workspaceId);
      return result;
    })
  );
