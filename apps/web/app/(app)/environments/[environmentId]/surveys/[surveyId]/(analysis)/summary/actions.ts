"use server";

import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { WEBAPP_URL } from "@/lib/constants";
import { putFile } from "@/lib/storage/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { convertToCsv } from "@/lib/utils/file-conversion";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { generatePersonalLinks } from "@/modules/ee/contacts/lib/contacts";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendEmbedSurveyPreviewEmail } from "@/modules/email";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const ZSendEmbedSurveyPreviewEmailAction = z.object({
  surveyId: ZId,
});

export const sendEmbedSurveyPreviewEmailAction = authenticatedActionClient
  .schema(ZSendEmbedSurveyPreviewEmailAction)
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
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
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
      survey.environmentId,
      organizationLogoUrl || ""
    );
  });

const ZGenerateResultShareUrlAction = z.object({
  surveyId: ZId,
});

export const generateResultShareUrlAction = authenticatedActionClient
  .schema(ZGenerateResultShareUrlAction)
  .action(
    withAuditLogging(
      "updated",
      "survey",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: Record<string, any>;
      }) => {
        const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId: organizationId,
          access: [
            {
              type: "organization",
              roles: ["owner", "manager"],
            },
            {
              type: "projectTeam",
              minPermission: "readWrite",
              projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
            },
          ],
        });

        const survey = await getSurvey(parsedInput.surveyId);
        if (!survey) {
          throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
        }

        const resultShareKey = customAlphabet(
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          20
        )();

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
        ctx.auditLoggingCtx.oldObject = survey;

        const newSurvey = await updateSurvey({ ...survey, resultShareKey });
        ctx.auditLoggingCtx.newObject = newSurvey;

        return resultShareKey;
      }
    )
  );

const ZGetResultShareUrlAction = z.object({
  surveyId: ZId,
});

export const getResultShareUrlAction = authenticatedActionClient
  .schema(ZGetResultShareUrlAction)
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
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    return survey.resultShareKey;
  });

const ZDeleteResultShareUrlAction = z.object({
  surveyId: ZId,
});

export const deleteResultShareUrlAction = authenticatedActionClient
  .schema(ZDeleteResultShareUrlAction)
  .action(
    withAuditLogging(
      "updated",
      "survey",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: Record<string, any>;
      }) => {
        const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId: organizationId,
          access: [
            {
              type: "organization",
              roles: ["owner", "manager"],
            },
            {
              type: "projectTeam",
              minPermission: "readWrite",
              projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
            },
          ],
        });

        const survey = await getSurvey(parsedInput.surveyId);
        if (!survey) {
          throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
        }

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
        ctx.auditLoggingCtx.oldObject = survey;

        const newSurvey = await updateSurvey({ ...survey, resultShareKey: null });
        ctx.auditLoggingCtx.newObject = newSurvey;

        return newSurvey;
      }
    )
  );

const ZGetEmailHtmlAction = z.object({
  surveyId: ZId,
});

export const getEmailHtmlAction = authenticatedActionClient
  .schema(ZGetEmailHtmlAction)
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
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return await getEmailTemplateHtml(parsedInput.surveyId, ctx.user.locale);
  });

const ZGeneratePersonalLinksAction = z.object({
  surveyId: ZId,
  segmentId: ZId,
  environmentId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalLinksAction = authenticatedActionClient
  .schema(ZGeneratePersonalLinksAction)
  .action(async ({ ctx, parsedInput }) => {
    try {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
            minPermission: "readWrite",
          },
        ],
      });

      // Get contacts and generate personal links
      const contactsResult = await generatePersonalLinks(
        parsedInput.surveyId,
        parsedInput.segmentId,
        parsedInput.expirationDays || 7
      );

      if (!contactsResult || contactsResult.length === 0) {
        throw new Error("No contacts found for the selected segment");
      }

      // Prepare CSV data with the specified headers and order
      const csvHeaders = [
        "Formbricks Contact ID",
        "User ID",
        "First Name",
        "Last Name",
        "Email",
        "Personal Link",
      ];

      const csvData = contactsResult.map((contact: any) => {
        const attributes = contact.attributes || {};
        return {
          "Formbricks Contact ID": contact.contactId,
          "User ID": attributes.userId || "",
          "First Name": attributes.firstName || "",
          "Last Name": attributes.lastName || "",
          Email: attributes.email || "",
          "Personal Link": contact.surveyUrl,
        };
      });

      // Convert to CSV using the file conversion utility
      const csvContent = await convertToCsv(csvHeaders, csvData);
      const fileName = `personal-links-${parsedInput.surveyId}-${Date.now()}.csv`;

      // Store file temporarily and return download URL
      const fileBuffer = Buffer.from(csvContent);
      await putFile(fileName, fileBuffer, "private", parsedInput.environmentId);

      const downloadUrl = `${WEBAPP_URL}/storage/${parsedInput.environmentId}/private/${fileName}`;

      return {
        downloadUrl,
        fileName,
        count: csvData.length,
      };
    } catch (error) {
      console.error("Error generating personal links:", error);
      throw new Error("Failed to generate personal links");
    }
  });
