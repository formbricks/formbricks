import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { NextRequest } from "next/server";
import { getSurvey } from "@formbricks/lib/survey/service";
import { generateSurveySingleUseIds } from "@formbricks/lib/utils/singleUseSurveys";

export const GET = async (
  request: NextRequest,
  { params }: { params: { surveyId: string } }
): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await getSurvey(params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }
    if (survey.environmentId !== authentication.environmentId) {
      throw new Error("Unauthorized");
    }

    if (!survey.singleUse || !survey.singleUse.enabled) {
      return responses.badRequestResponse("Single use links are not enabled for this survey");
    }
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 10;

    if (limit < 1) {
      return responses.badRequestResponse("Limit cannot be less than 1");
    }

    if (limit > 5000) {
      return responses.badRequestResponse("Limit cannot be more than 5000");
    }

    const singleUseIds = generateSurveySingleUseIds(limit, survey.singleUse.isEncrypted);

    // map single use ids to survey links
    const surveyLinks = singleUseIds.map(
      (singleUseId) => `${process.env.WEBAPP_URL}/s/${survey.id}?suId=${singleUseId}`
    );

    return responses.successResponse(surveyLinks);
  } catch (error) {
    return handleErrorResponse(error);
  }
};
