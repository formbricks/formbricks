import { responses } from "@/lib/api/response";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { authenticateRequest } from "@/app/api/v1/auth";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { TAttributeClass, ZAttributeClassInput } from "@formbricks/types/v1/attributeClasses";
import { createAttributeClass, getAttributeClasses } from "@formbricks/lib/attributeClass/service";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const atributeClasses: TAttributeClass[] = await getAttributeClasses(authentication.environmentId!);
    return responses.successResponse(atributeClasses);
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
    const attributeClassInput = await request.json();
    const inputValidation = ZAttributeClassInput.safeParse(attributeClassInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const attributeClass: TAttributeClass | null = await createAttributeClass(
      authentication.environmentId,
      inputValidation.data.name,
      inputValidation.data.type
    );
    if (!attributeClass) {
      return responses.internalServerErrorResponse("Failed creating attribute class");
    }
    return responses.successResponse(attributeClass);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
