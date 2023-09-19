import { responses } from "@/lib/api/response";
import { getPerson } from "@formbricks/lib/services/person";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";
import { NextResponse } from "next/server";
import { deletePerson } from "@formbricks/lib/services/person";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { TPerson } from "@formbricks/types/v1/people";
import { authenticateRequest } from "@/app/api/v1/auth";

async function fetchAndValidatePerson(authentication: any, personId: string): Promise<TPerson | null> {
  const person = await getPerson(personId);
  if (!person) {
    return null;
  }
  if (!(await canUserAccessPeople(authentication, person))) {
    throw new Error("Unauthorized");
  }
  return person;
}

const canUserAccessPeople = async (authentication: any, person: TPerson): Promise<boolean> => {
  if (!authentication) return false;

  if (authentication.type === "session") {
    return await hasUserEnvironmentAccess(authentication.session.user, person.environmentId);
  } else if (authentication.type === "apiKey") {
    return person.environmentId === authentication.environmentId;
  } else {
    throw Error("Unknown authentication type");
  }
};

export async function GET(
  request: Request,
  { params }: { params: { personId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const person = await fetchAndValidatePerson(authentication, params.personId);
    if (person) {
      return responses.successResponse(person);
    }
    return responses.notFoundResponse("Person", params.personId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { personId: string } }) {
  try {
    const authentication = await authenticateRequest(request);
    const person = await fetchAndValidatePerson(authentication, params.personId);
    if (!person) {
      return responses.notFoundResponse("Survey", params.personId);
    }
    await deletePerson(params.personId);
    return responses.successResponse({ success: "Person deleted successfully" });
  } catch (error) {
    return handleErrorResponse(error);
  }
}

function handleErrorResponse(error: any): NextResponse {
  switch (error.message) {
    case "NotAuthenticated":
      return responses.notAuthenticatedResponse();
    case "Unauthorized":
      return responses.unauthorizedResponse();
    default:
      if (
        error instanceof DatabaseError ||
        error instanceof InvalidInputError ||
        error instanceof ResourceNotFoundError
      ) {
        return responses.badRequestResponse(error.message);
      }
      return responses.internalServerErrorResponse("Some error occurred");
  }
}
