import { responses } from "@/lib/api/response";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { authenticateRequest } from "@/app/api/v1/auth";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { getProfile, getUserIdFromEnvironment, updateProfile } from "@formbricks/lib/services/profile";
import { TProfile, ZProfileUpdateInput } from "@formbricks/types/v1/profile";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      return responses.notAuthenticatedResponse();
    }
    let userId;
    if (authentication.type === "session") {
      userId = authentication.session.user.id;
    } else {
      userId = await getUserIdFromEnvironment(authentication.environmentId);
    }
    const profile = await getProfile(userId);
    if (profile) {
      return responses.successResponse(profile);
    }
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      return responses.notAuthenticatedResponse();
    }
    let userId;
    if (authentication.type === "session") {
      userId = authentication.session.user.id;
    } else {
      userId = await getUserIdFromEnvironment(authentication.environmentId);
    }

    const profileInput = await request.json();
    const inputValidation = ZProfileUpdateInput.safeParse(profileInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const profile: TProfile = await updateProfile(userId, inputValidation.data);
    return responses.successResponse(profile);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
