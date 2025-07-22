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
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendEmbedSurveyPreviewEmail } from "@/modules/email";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import { deleteResponsesAndDisplaysForSurvey } from "./lib/survey";

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

const ZResetSurveyAction = z.object({
  surveyId: ZId,
  organizationId: ZId,
  projectId: ZId,
});

export const resetSurveyAction = authenticatedActionClient.schema(ZResetSurveyAction).action(
  withAuditLogging(
    "updated",
    "survey",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZResetSurveyAction>;
    }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: parsedInput.projectId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
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
    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      throw new OperationNotAllowedError("Contacts are not enabled for this environment");
    }

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
      parsedInput.expirationDays
    );

    if (!contactsResult || contactsResult.length === 0) {
      throw new UnknownError("No contacts found for the selected segment");
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

    // Store file temporarily and return download URL
    const fileBuffer = Buffer.from(csvContent);
    await putFile(fileName, fileBuffer, "private", parsedInput.environmentId);

    const downloadUrl = `${WEBAPP_URL}/storage/${parsedInput.environmentId}/private/${fileName}`;

    return {
      downloadUrl,
      fileName,
      count: csvData.length,
    };
  });

const ZUpdateSingleUseLinksAction = z.object({
  surveyId: ZId,
  environmentId: ZId,
  isSingleUse: z.boolean(),
  isSingleUseEncryption: z.boolean(),
});

export const updateSingleUseLinksAction = authenticatedActionClient
  .schema(ZUpdateSingleUseLinksAction)
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

    const updatedSurvey = await updateSurvey({
      ...survey,
      singleUse: { enabled: parsedInput.isSingleUse, isEncrypted: parsedInput.isSingleUseEncryption },
    });

    return updatedSurvey;
  });
