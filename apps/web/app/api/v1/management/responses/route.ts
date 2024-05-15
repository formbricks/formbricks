import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { NextRequest } from "next/server";

import { getResponses, getResponsesByEnvironmentId } from "@formbricks/lib/response/service";
import { DatabaseError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";

export const GET = async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const surveyId = searchParams.get("surveyId");
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.get("skip") ? Number(searchParams.get("skip")) : undefined;

  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    let environmentResponses: TResponse[] = [];

    if (surveyId) {
      environmentResponses = await getResponses(surveyId, limit, offset);
    } else {
      environmentResponses = await getResponsesByEnvironmentId(authentication.environmentId!, limit, offset);
    }
    return responses.successResponse(environmentResponses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
