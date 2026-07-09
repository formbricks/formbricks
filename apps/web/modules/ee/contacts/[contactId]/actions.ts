"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromContactId,
  getWorkspaceIdFromContactId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";

const ZGeneratePersonalSurveyLinkAction = z.object({
  contactId: ZId,
  surveyId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalSurveyLinkAction = authenticatedActionClient
  .inputSchema(ZGeneratePersonalSurveyLinkAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
    const workspaceId = await getWorkspaceIdFromContactId(parsedInput.contactId);

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
          workspaceId,
        },
      ],
    });

    // Cross-tenant guard: the survey must belong to the same workspace as the
    // contact the caller was authorized against. Authorization above is derived
    // from `contactId` only, so without this a caller could pass a `surveyId`
    // from another workspace and mint a working personal link for it. Mirrors the
    // workspace assertion the segment-based personal-links path performs.
    const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    if (surveyWorkspaceId !== workspaceId) {
      throw new ValidationError(CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE);
    }

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

    return {
      surveyUrl: result.data,
    };
  });
