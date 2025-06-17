import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getSurvey } from "@/lib/survey/service";
import { generateSurveySingleUseIds } from "@/lib/utils/single-use-surveys";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ surveyId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await getSurvey(params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }
    if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "GET")) {
      return responses.unauthorizedResponse();
    }

    if (survey.type !== "link") {
      return responses.badRequestResponse("Single use links are only available for link surveys");
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

    const publicDomain = getPublicDomain();
    // map single use ids to survey links
    const surveyLinks = singleUseIds.map(
      (singleUseId) => `${publicDomain}/s/${survey.id}?suId=${singleUseId}`
    );

    return responses.successResponse(surveyLinks);
  } catch (error) {
    return handleErrorResponse(error);
  }
};
