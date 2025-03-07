import { surveyIdSchema } from "@/modules/api/v2/management/surveys/[surveyId]/types/survey";
import { ZSurveyInput } from "@/modules/api/v2/management/surveys/types/surveys";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZSurveyWithoutQuestionType } from "@formbricks/database/zod/surveys";

export const getSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "getSurvey",
  summary: "Get a survey",
  description: "Gets a survey from the database.",
  requestParams: {
    path: z.object({
      id: surveyIdSchema,
    }),
  },
  tags: ["Management API > Surveys"],
  responses: {
    "200": {
      description: "Response retrieved successfully.",
      content: {
        "application/json": {
          schema: ZSurveyWithoutQuestionType,
        },
      },
    },
  },
};

export const deleteSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteSurvey",
  summary: "Delete a survey",
  description: "Deletes a survey from the database.",
  tags: ["Management API > Surveys"],
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
          schema: ZSurveyWithoutQuestionType,
        },
      },
    },
  },
};

export const updateSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateSurvey",
  summary: "Update a survey",
  description: "Updates a survey in the database.",
  tags: ["Management API >  Surveys"],
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
          schema: ZSurveyWithoutQuestionType,
        },
      },
    },
  },
};
