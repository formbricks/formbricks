import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextResponse } from "next/server";

import { createActionClass, getActionClasses } from "@formbricks/lib/actionClass/service";
import { TActionClass, ZActionClassInput } from "@formbricks/types/actionClasses";
import { DatabaseError } from "@formbricks/types/errors";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClasses: TActionClass[] = await getActionClasses(authentication.environmentId!);
    return responses.successResponse(actionClasses);
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
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClassInput = await request.json();
    const inputValidation = ZActionClassInput.safeParse(actionClassInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const actionClass: TActionClass = await createActionClass(
      authentication.environmentId!,
      inputValidation.data
    );
    return responses.successResponse(actionClass);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
