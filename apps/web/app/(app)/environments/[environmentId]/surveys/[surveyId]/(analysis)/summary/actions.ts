"use server";

import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { generateText } from "ai";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { sendEmbedSurveyPreviewEmail } from "@formbricks/email";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { llmModel } from "@formbricks/lib/ai";
import { clusterDocuments } from "@formbricks/lib/document/kmeans";
import { getDocumentsByTypeAndReferenceId } from "@formbricks/lib/document/service";
import { getQuestionResponseReferenceId } from "@formbricks/lib/document/utils";
import { getOrganizationIdFromSurveyId } from "@formbricks/lib/organization/utils";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const ZSendEmbedSurveyPreviewEmailAction = z.object({
  surveyId: ZId,
});

export const sendEmbedSurveyPreviewEmailAction = authenticatedActionClient
  .schema(ZSendEmbedSurveyPreviewEmailAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const rawEmailHtml = await getEmailTemplateHtml(parsedInput.surveyId);
    const emailHtml = rawEmailHtml
      .replaceAll("?preview=true&amp;", "?")
      .replaceAll("?preview=true&;", "?")
      .replaceAll("?preview=true", "");

    return await sendEmbedSurveyPreviewEmail(
      ctx.user.email,
      "Formbricks Email Survey Preview",
      emailHtml,
      survey.environmentId
    );
  });

const ZGenerateResultShareUrlAction = z.object({
  surveyId: ZId,
});

export const generateResultShareUrlAction = authenticatedActionClient
  .schema(ZGenerateResultShareUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "update"],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const resultShareKey = customAlphabet(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      20
    )();

    await updateSurvey({ ...survey, resultShareKey });

    return resultShareKey;
  });

const ZGetResultShareUrlAction = z.object({
  surveyId: ZId,
});

export const getResultShareUrlAction = authenticatedActionClient
  .schema(ZGetResultShareUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "read"],
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
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "update"],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    return await updateSurvey({ ...survey, resultShareKey: null });
  });

const ZGetEmailHtmlAction = z.object({
  surveyId: ZId,
});

export const getEmailHtmlAction = authenticatedActionClient
  .schema(ZGetEmailHtmlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    return await getEmailTemplateHtml(parsedInput.surveyId);
  });

const ZGetOpenTextSummaryAction = z.object({
  surveyId: ZId,
  questionId: ZId,
});

export const getOpenTextSummaryAction = authenticatedActionClient
  .schema(ZGetOpenTextSummaryAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    const survey = await getSurvey(parsedInput.surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const documents = await getDocumentsByTypeAndReferenceId(
      "questionResponse",
      getQuestionResponseReferenceId(parsedInput.surveyId, parsedInput.questionId)
    );

    const topics = await clusterDocuments(documents, 3);

    const question = survey.questions.find((q) => q.id === parsedInput.questionId);
    const prompt = `You are an AI research assistant and answer the question: "${question?.headline.default}". Please in markdown provide a short summary sentence and provide 3 bullet points for insights you got from these samples including the number of responses for this topic:\n${topics.map((t) => t.centralDocument.text).join("\n")}`;

    try {
      const { text } = await generateText({
        model: llmModel,
        prompt,
      });
      return text;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to generate summary");
    }
  });
