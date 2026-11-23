"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getContactInWorkspace } from "@/modules/ee/contacts/lib/contacts";
import { ensureContactsEnabled } from "@/modules/ee/contacts/lib/contacts-entitlement";
import { CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";

const ZGeneratePersonalSurveyLinkAction = z.object({
  contactId: ZId,
  surveyId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalSurveyLinkAction = authenticatedActionClient
  .inputSchema(ZGeneratePersonalSurveyLinkAction)
  .action(
    withAuditLogging("created", "contact", async ({ ctx, parsedInput }) => {
      // Authorized on the survey's workspace: a contact's own `workspaceId` only records where it was
      // created. The contact must then be in that workspace's contact directory, so a caller cannot mint
      // a link for a contact of another directory.
      const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: workspaceId,
      });
      await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

      await ensureContactsEnabled(organizationId);

      if (!(await getContactInWorkspace(parsedInput.contactId, workspaceId))) {
        throw new ValidationError(CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE);
      }

      // ENG-3282: a personal link writes responses into this survey, so a restricted one needs the
      // survey's own write permission, not the workspace's.
      await assertCan({ type: "user", id: ctx.user.id }, "survey.write", {
        type: "survey",
        id: parsedInput.surveyId,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.contactId = parsedInput.contactId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;

      const result = await getContactSurveyLink(
        parsedInput.contactId,
        parsedInput.surveyId,
        parsedInput.expirationDays
      );

      if (!result.ok) {
        if (result.error.type === "not_found") {
          throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
        }
        if (result.error.type === "bad_request") {
          const errorMessage = result.error.details?.[0]?.issue || "Invalid request";
          throw new InvalidInputError(errorMessage);
        }
        const errorMessage = result.error.details?.[0]?.issue || "Failed to generate personal survey link";
        throw new InvalidInputError(errorMessage);
      }

      capturePostHogEvent(
        ctx.user.id,
        "personal_link_created",
        {
          organization_id: organizationId,
          workspace_id: workspaceId,
          survey_id: parsedInput.surveyId,
        },
        { organizationId, workspaceId: workspaceId }
      );

      const response = {
        surveyUrl: result.data,
      };
      ctx.auditLoggingCtx.newObject = { surveyId: parsedInput.surveyId };
      return response;
    })
  );
