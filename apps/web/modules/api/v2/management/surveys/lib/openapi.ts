import { createSurveyEndpoint, getSurveysEndpoint } from "@/modules/api/v2/lib/openapi";
import {
  deleteSurveyEndpoint,
  getSurveyEndpoint,
  updateSurveyEndpoint,
} from "@/modules/api/v2/management/surveys/[surveyId]/lib/openapi";
import { ZodOpenApiPathsObject } from "zod-openapi";

export const surveyPaths: ZodOpenApiPathsObject = {
  "/surveys": {
    get: getSurveysEndpoint,
    post: createSurveyEndpoint,
  },
  "/surveys/{id}": {
    get: getSurveyEndpoint,
    put: updateSurveyEndpoint,
    delete: deleteSurveyEndpoint,
  },
};
