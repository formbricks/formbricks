"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getEmailTemplateHtml } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { DEFAULT_EXAMPLE_RESPONSE_COUNT } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-response-options";
import {
  ZExampleResponseCount,
  generateExampleResponseDataset,
  toExampleResponseInput,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses";
import { createResponseWithQuotaEvaluation } from "@/app/api/v1/client/[workspaceId]/responses/lib/response";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { addTagToRespone } from "@/lib/tagOnResponse/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { convertToCsv } from "@/lib/utils/file-conversion";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { generatePersonalLinks } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendEmbedSurveyPreviewEmail } from "@/modules/email";
import { deleteResponsesAndDisplaysForSurvey } from "./lib/survey";

const ZSendEmbedSurveyPreviewEmailAction = z.object({
  surveyId: ZId,
});

export const sendEmbedSurveyPreviewEmailAction = authenticatedActionClient
  .inputSchema(ZSendEmbedSurveyPreviewEmailAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const organizationLogoUrl = await getOrganizationLogoUrl(organizationId);

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
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const rawEmailHtml = await getEmailTemplateHtml(parsedInput.surveyId, ctx.user.locale);
    const emailHtml = rawEmailHtml
      .replaceAll("?preview=true&amp;", "?")
      .replaceAll("?preview=true&;", "?")
      .replaceAll("?preview=true", "");

    return await sendEmbedSurveyPreviewEmail(
      ctx.user.email,
      emailHtml,
      survey.workspaceId,
      ctx.user.locale,
      organizationLogoUrl || ""
    );
  });

const ZResetSurveyAction = z.object({
  surveyId: ZId,
  workspaceId: ZId,
});

export const resetSurveyAction = authenticatedActionClient.inputSchema(ZResetSurveyAction).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

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

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
    ctx.auditLoggingCtx.oldObject = null;

    const { deletedResponsesCount, deletedDisplaysCount } = await deleteResponsesAndDisplaysForSurvey(
      parsedInput.surveyId
    );

    ctx.auditLoggingCtx.newObject = {
      deletedResponsesCount: deletedResponsesCount,
      deletedDisplaysCount: deletedDisplaysCount,
    };

    return {
      success: true,
      deletedResponsesCount: deletedResponsesCount,
      deletedDisplaysCount: deletedDisplaysCount,
    };
  })
);

const ZGenerateExampleResponsesAction = z.object({
  surveyId: ZId,
  // How many example responses to create. Restricted to the fixed options the
  // popover offers so a crafted request can't drive up LLM/DB cost arbitrarily.
  count: ZExampleResponseCount.default(DEFAULT_EXAMPLE_RESPONSE_COUNT),
});

// Generates a user-chosen number (see ZExampleResponseCount) of LLM-authored
// example responses for a survey that has no real responses yet. Server-side
// gates: caller must have write access,
// the org's AI smart-tools feature must be enabled and entitled, and the
// survey must currently have zero responses (button is also hidden client-side
// when responseCount > 0, but we re-check here so a stale tab can't insert
// noise into a live survey).
export const generateExampleResponsesAction = authenticatedActionClient
  .inputSchema(ZGenerateExampleResponsesAction)
  .action(async ({ ctx, parsedInput }) => {
    // Per-user limit (1 per minute). Closes the multi-click race window where
    // two clicks fired before the first LLM call returns could both pass the
    // responseCount === 0 check, and bounds a single user's overall LLM spend.
    await applyRateLimit(rateLimitConfigs.actions.generateExampleResponses, ctx.user.id);

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

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

    // Throws OperationNotAllowedError if AI is unentitled, disabled, or
    // the instance isn't configured (env vars). Same gating helper that the
    // existing AI text endpoint uses.
    await assertOrganizationAIConfigured(organizationId);

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const existingCount = await getResponseCountBySurveyId(parsedInput.surveyId);
    if (existingCount > 0) {
      throw new OperationNotAllowedError(
        "Example responses can only be generated for a survey that has no responses yet."
      );
    }

    const generatedDataset = await generateExampleResponseDataset({
      survey,
      organizationId,
      count: parsedInput.count,
    });
    if (generatedDataset.responses.length === 0) {
      throw new InvalidInputError(
        "This survey doesn't contain any question types we can synthesize answers for yet."
      );
    }

    // Tag every synthetic response so users can tell them apart from real ones
    // in the responses list. Upsert handles the case where a previous run (or a
    // user) already created the tag in this workspace.
    const aiTag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId, name: generatedDataset.tagName } },
      create: { workspaceId, name: generatedDataset.tagName },
      update: {},
    });

    for (const item of generatedDataset.responses) {
      // Each response gets its own Display so the dashboard's "displays" count
      // and completion-rate calc line up with the response row. Backdate the
      // display to the same moment as the response — the assertDisplayOwnership
      // check inside createResponse runs against the matching surveyId.
      const display = await prisma.display.create({
        data: { survey: { connect: { id: survey.id } }, createdAt: item.createdAt },
        select: { id: true },
      });

      const response = await createResponseWithQuotaEvaluation(
        toExampleResponseInput(survey.id, workspaceId, item, display.id)
      );
      await addTagToRespone(response.id, aiTag.id);
      // `createResponse` ignores caller-supplied createdAt; backdate after the
      // fact so the responses-over-time chart shows a realistic spread.
      await prisma.response.update({
        where: { id: response.id },
        data: { createdAt: item.createdAt },
      });
    }

    // Extra view-only displays simulate respondents who saw the survey but
    // didn't submit. Without these the completion rate would read 100%.
    if (generatedDataset.displays.length > 0) {
      await prisma.display.createMany({
        data: generatedDataset.displays.map(({ createdAt }) => ({ surveyId: survey.id, createdAt })),
      });
    }

    return { createdCount: generatedDataset.responses.length };
  });

const ZGetEmailHtmlAction = z.object({
  surveyId: ZId,
});

export const getEmailHtmlAction = authenticatedActionClient
  .inputSchema(ZGetEmailHtmlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return await getEmailTemplateHtml(parsedInput.surveyId, ctx.user.locale);
  });

const ZGeneratePersonalLinksAction = z.object({
  surveyId: ZId,
  segmentId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalLinksAction = authenticatedActionClient
  .inputSchema(ZGeneratePersonalLinksAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    const isContactsEnabled = await getIsContactsEnabled(organizationId);
    if (!isContactsEnabled) {
      throw new OperationNotAllowedError("Contacts are not enabled for this workspace");
    }

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
          workspaceId,
          minPermission: "readWrite",
        },
      ],
    });

    // Get contacts and generate personal links
    const contactsResult = await generatePersonalLinks(
      parsedInput.surveyId,
      parsedInput.segmentId,
      parsedInput.expirationDays
    );

    if (!contactsResult || contactsResult.length === 0) {
      throw new InvalidInputError("No contacts found for the selected segment");
    }

    capturePostHogEvent(
      ctx.user.id,
      "personal_link_created",
      {
        organization_id: organizationId,
        workspace_id: workspaceId,
        survey_id: parsedInput.surveyId,
        link_count: contactsResult.length,
      },
      { organizationId, workspaceId }
    );

    // Prepare CSV data with the specified headers and order
    const csvHeaders = [
      "Formbricks Contact ID",
      "User ID",
      "First Name",
      "Last Name",
      "Email",
      "Personal Link",
    ];

    const csvData = contactsResult
      .map((contact) => {
        if (!contact) {
          return null;
        }
        const attributes = contact.attributes ?? {};
        return {
          "Formbricks Contact ID": contact.contactId,
          "User ID": attributes.userId ?? "",
          "First Name": attributes.firstName ?? "",
          "Last Name": attributes.lastName ?? "",
          Email: attributes.email ?? "",
          "Personal Link": contact.surveyUrl,
        };
      })
      .filter((contact) => contact !== null);

    // Convert to CSV using the file conversion utility
    const csvContent = await convertToCsv(csvHeaders, csvData);
    const fileName = `personal-links-${parsedInput.surveyId}-${Date.now()}.csv`;

    return {
      fileName,
      csvContent,
    };
  });

const ZUpdateSingleUseLinksAction = z.object({
  surveyId: ZId,
  workspaceId: ZId,
  isSingleUse: z.boolean(),
  isSingleUseEncryption: z.boolean(),
});

export const updateSingleUseLinksAction = authenticatedActionClient
  .inputSchema(ZUpdateSingleUseLinksAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const updatedSurvey = await updateSurvey({
      ...survey,
      singleUse: { enabled: parsedInput.isSingleUse, isEncrypted: parsedInput.isSingleUseEncryption },
    });

    return updatedSurvey;
  });
