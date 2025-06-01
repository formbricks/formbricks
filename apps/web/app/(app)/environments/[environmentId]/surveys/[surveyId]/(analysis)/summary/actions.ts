"use server";

import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
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
    withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
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
    })
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
    withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
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
    })
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
