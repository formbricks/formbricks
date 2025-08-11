import { checkFeaturePermissions } from "@/app/api/v1/management/surveys/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { createSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { ZSurveyCreateInputWithEnvironmentId } from "@formbricks/types/surveys/types";
import { getSurveys } from "./lib/surveys";

export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    authentication,
  }: {
    req: NextRequest;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    try {
      const searchParams = new URL(req.url).searchParams;
      const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
      const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );
      const surveys = await getSurveys(environmentIds, limit, offset);

      return {
        response: responses.successResponse(surveys),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  },
});

export const POST = withV1ApiWrapper({
  handler: async ({
    req,
    auditLog,
    authentication,
  }: {
    req: NextRequest;
    auditLog: TApiAuditLog;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    try {
      let surveyInput;
      try {
        surveyInput = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }
      const inputValidation = ZSurveyCreateInputWithEnvironmentId.safeParse(surveyInput);

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }

      const { environmentId } = inputValidation.data;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
        return {
          response: responses.unauthorizedResponse(),
        };
      }

      const organization = await getOrganizationByEnvironmentId(environmentId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }

      const surveyData = { ...inputValidation.data, environmentId };

      const featureCheckResult = await checkFeaturePermissions(surveyData, organization);
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
        };
      }

      const survey = await createSurvey(environmentId, { ...surveyData, environmentId: undefined });
      auditLog.targetId = survey.id;
      auditLog.newObject = survey;

      return {
        response: responses.successResponse(survey),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.internalServerErrorResponse(error.message),
        };
      }
      throw error;
    }
  },
  action: "created",
  targetType: "survey",
});
