import { responses } from "@/lib/api/response";
import { createResponse, getEnvironmentResponses } from "@formbricks/lib/services/response";
import { authenticateRequest } from "@/app/api/v1/auth";
import { NextResponse } from "next/server";
import { TResponse, ZResponseInput } from "@formbricks/types/v1/responses";
import { transformErrorToDetails } from "@/lib/api/validator";
import { DatabaseError } from "@formbricks/types/v1/errors";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      responses.notAuthenticatedResponse();
    }
    const responseArray = await getEnvironmentResponses(authentication.environmentId!);
    return responses.successResponse(responseArray);
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

    const responseInput = await request.json();
    const inputValidation = ZResponseInput.safeParse(responseInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const response: TResponse = await createResponse(inputValidation.data);
    return responses.successResponse(response);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
