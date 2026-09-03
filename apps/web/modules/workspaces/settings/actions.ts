"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { isWorkspaceDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/workspace/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { getTeamsByOrganizationId } from "@/modules/ee/teams/team-list/lib/team";
import { updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { ZWorkspaceUpdateActionInput } from "@/modules/workspaces/settings/lib/workspace-update-input";

const ZUpdateWorkspaceAction = z.object({
  workspaceId: ZId,
  data: ZWorkspaceUpdateActionInput,
});

export const updateWorkspaceAction = authenticatedActionClient.inputSchema(ZUpdateWorkspaceAction).action(
  withAuditLogging("updated", "workspace", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.manage", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.workspaceId);

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

    // The default survey language has to be one of the workspace's own survey languages, so the setting
    // can never name a language the workspace does not have (ENG-2816). The input schema already limits
    // it to the languages the survey runtime ships strings for; this is the half that needs the
    // workspace, and it pairs with `deleteLanguage` refusing to remove the language it points at.
    const nextDefaultSurveyLanguage = parsedInput.data.config?.defaultSurveyLanguage;
    if (
      nextDefaultSurveyLanguage &&
      !oldObject?.languages.some((language) =>
        isWorkspaceDefaultSurveyLanguage(language.code, nextDefaultSurveyLanguage)
      )
    ) {
      throw new OperationNotAllowedError(
        "The default survey language must be one of the workspace's survey languages"
      );
    }

    const result = await updateWorkspace(parsedInput.workspaceId, parsedInput.data);
    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = result;

    const groupContext = { organizationId, workspaceId: parsedInput.workspaceId };

    if (oldObject?.linkSurveyBranding === true && parsedInput.data.linkSurveyBranding === false) {
      capturePostHogEvent(
        ctx.user.id,
        "remove_branding_enabled",
        {
          organization_id: organizationId,
          workspace_id: parsedInput.workspaceId,
          branding_type: "link",
        },
        groupContext
      );
    }

    if (oldObject?.inAppSurveyBranding === true && parsedInput.data.inAppSurveyBranding === false) {
      capturePostHogEvent(
        ctx.user.id,
        "remove_branding_enabled",
        {
          organization_id: organizationId,
          workspace_id: parsedInput.workspaceId,
          branding_type: "in_app",
        },
        groupContext
      );
    }

    return result;
  })
);

const ZGetTeamsByOrganizationIdAction = z.object({
  organizationId: ZId,
});

export const getTeamsByOrganizationIdAction = authenticatedActionClient
  .inputSchema(ZGetTeamsByOrganizationIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "organization.manage", {
      type: "organization",
      id: parsedInput.organizationId,
    });
    const teams = await getTeamsByOrganizationId(parsedInput.organizationId);
    return teams;
  });
