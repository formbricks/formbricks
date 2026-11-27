import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import {
  ZContactLinkParams,
  ZContactLinkQuery,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/types/survey";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";

export const getPersonalizedSurveyLink: ZodOpenApiOperationObject = {
  operationId: "getPersonalizedSurveyLink",
  summary: "Get personalized survey link for a contact",
  description:
    "Retrieves a personalized link for a specific survey. Although this is a GET, it creates a credential: the link lets whoever holds it submit a response as the contact. The API key therefore needs read & write access to the workspace; a read-only key, or a key restricted from this survey, is rejected with 401.",
  requestParams: {
    path: ZContactLinkParams,
    query: ZContactLinkQuery,
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
                surveyUrl: z.url(),
                expiresAt: z
                  .string()
                  .nullable()
                  .describe("The date and time the link expires, null if no expiration"),
              }),
            })
          ),
        },
      },
    },
  },
};
