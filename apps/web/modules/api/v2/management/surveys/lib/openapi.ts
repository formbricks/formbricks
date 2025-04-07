// import {
//   deleteSurveyEndpoint,
//   getSurveyEndpoint,
//   updateSurveyEndpoint,
// } from "@/modules/api/v2/management/surveys/[surveyId]/lib/openapi";
import { getPersonalizedSurveyLink } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/lib/openapi";
import { ZGetSurveysFilter, ZSurveyInput } from "@/modules/api/v2/management/surveys/types/surveys";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZSurveyWithoutQuestionType } from "@formbricks/database/zod/surveys";

export const getSurveysEndpoint: ZodOpenApiOperationObject = {
  operationId: "getSurveys",
  summary: "Get surveys",
  description: "Gets surveys from the database.",
  requestParams: {
    query: ZGetSurveysFilter,
  },
  tags: ["Management API > Surveys"],
  responses: {
    "200": {
      description: "Surveys retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZSurveyWithoutQuestionType),
        },
      },
    },
  },
};

export const createSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "createSurvey",
  summary: "Create a survey",
  description: "Creates a survey in the database.",
  tags: ["Management API > Surveys"],
  requestBody: {
    required: true,
    description: "The survey to create",
    content: {
      "application/json": {
        schema: ZSurveyInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Survey created successfully.",
      content: {
        "application/json": {
          schema: ZSurveyWithoutQuestionType,
        },
      },
    },
  },
};

export const surveyPaths: ZodOpenApiPathsObject = {
  // "/surveys": {
  //   get: getSurveysEndpoint,
  //   post: createSurveyEndpoint,
  // },
  // "/surveys/{id}": {
  //   get: getSurveyEndpoint,
  //   put: updateSurveyEndpoint,
  //   delete: deleteSurveyEndpoint,
  // },
  "/surveys/{id}/contact-links/contacts/{contactId}/": {
    get: getPersonalizedSurveyLink,
  },
};
