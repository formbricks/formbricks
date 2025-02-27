import { surveyIdSchema } from "@/modules/api/v2/management/surveys/[surveyId]/types/survey";
import { ZSurveyInput } from "@/modules/api/v2/management/surveys/types/surveys";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZSurvey } from "@formbricks/database/zod/surveys";

export const getSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "getSurvey",
  summary: "Get a survey",
  description: "Gets a survey from the database.",
  requestParams: {
    path: z.object({
      id: surveyIdSchema,
    }),
  },
  tags: ["surveys"],
  responses: {
    "200": {
      description: "Response retrieved successfully.",
      content: {
        "application/json": {
          schema: ZSurvey,
        },
      },
    },
  },
};

export const deleteSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteSurvey",
  summary: "Delete a survey",
  description: "Deletes a survey from the database.",
  tags: ["surveys"],
  requestParams: {
    path: z.object({
      id: surveyIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Response deleted successfully.",
      content: {
        "application/json": {
          schema: ZSurvey,
        },
      },
    },
  },
};

export const updateSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateSurvey",
  summary: "Update a survey",
  description: "Updates a survey in the database.",
  tags: ["surveys"],
  requestParams: {
    path: z.object({
      id: surveyIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The survey to update",
    content: {
      "application/json": {
        schema: ZSurveyInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Response updated successfully.",
      content: {
        "application/json": {
          schema: ZSurvey,
        },
      },
    },
  },
};
