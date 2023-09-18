import { responses } from "@/lib/api/response";
import { authenticateRequest } from "@/app/api/v1/auth";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { createSurvey, getSurveys } from "@formbricks/lib/services/survey";
import { ZSurveyInput } from "@formbricks/types/v1/surveys";
import { DatabaseError } from "@formbricks/types/v1/errors";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      responses.notAuthenticatedResponse();
    }
    const surveys = await getSurveys(authentication.environmentId!);
    return responses.successResponse(surveys);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      return responses.notAuthenticatedResponse();
    }

    const surveyInput = await request.json();
    const inputValidation = ZSurveyInput.safeParse(surveyInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const survey = await createSurvey(authentication.environmentId!, inputValidation.data);
    return responses.successResponse(survey);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
