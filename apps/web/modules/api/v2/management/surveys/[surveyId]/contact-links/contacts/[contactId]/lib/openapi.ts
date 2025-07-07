import { ZContactLinkParams } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/types/survey";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";

export const getPersonalizedSurveyLink: ZodOpenApiOperationObject = {
  operationId: "getPersonalizedSurveyLink",
  summary: "Get personalized survey link for a contact",
  description: "Retrieves a personalized link for a specific survey.",
  requestParams: {
    path: ZContactLinkParams,
  },
  tags: ["Management API - Surveys - Contact Links"],
  responses: {
    "200": {
      description: "Personalized survey link retrieved successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(
            z.object({
              data: z.object({
                surveyUrl: z.string().url(),
              }),
            })
          ),
        },
      },
    },
  },
};
