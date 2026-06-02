import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteV3Survey, getV3Survey, patchV3SurveyResponse } from "../lib/operations";
import { parseV3SurveyLanguageQuery } from "../language";
import { ZV3EmptyQuery } from "../schemas";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

const surveyQuerySchema = z
  .object({
    lang: z
      .union([z.string(), z.array(z.string())])
      .transform((value, ctx) => {
        const parsedLanguageQuery = parseV3SurveyLanguageQuery(value);

        if (!parsedLanguageQuery.ok) {
          ctx.addIssue({
            code: "custom",
            message: parsedLanguageQuery.message,
          });
          return z.NEVER;
        }

        return parsedLanguageQuery.languages;
      })
      .optional(),
  })
  .strict();

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: surveyParamsSchema,
    query: surveyQuerySchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    return await getV3Survey({
      surveyId: parsedInput.params.surveyId,
      lang: parsedInput.query.lang,
      authentication,
      requestId,
      instance,
    });
  },
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
    query: ZV3EmptyQuery,
    body: z.unknown(),
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    return await patchV3SurveyResponse({
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    return await deleteV3Survey({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});
