import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/lib/api/response";
import { deletePerson, getPerson } from "@formbricks/lib/person/service";
import { TAuthenticationApiKey } from "@formbricks/types/v1/auth";
import { TPerson } from "@formbricks/types/v1/people";
import { NextResponse } from "next/server";

async function fetchAndAuthorizePerson(
  authentication: TAuthenticationApiKey,
  personId: string
): Promise<TPerson | null> {
  const person = await getPerson(personId);
  if (!person) {
    return null;
  }
  if (person.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return person;
}

export async function GET(
  request: Request,
  { params }: { params: { personId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const person = await fetchAndAuthorizePerson(authentication, params.personId);
    if (person) {
      return responses.successResponse(person);
    }
    return responses.notFoundResponse("Person", params.personId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

// Please use the methods provided by the client API to update a person

/* export async function PUT(
  request: Request,
  { params }: { params: { personId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    await fetchAndAuthorizePerson(authentication, params.personId);

    const personUpdate = await request.json();
    const inputValidation = ZPersonUpdateInput.safeParse(personUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    return responses.successResponse(await updatePerson(params.personId, inputValidation.data));
  } catch (error) {
    return handleErrorResponse(error);
  }
} */

export async function DELETE(request: Request, { params }: { params: { personId: string } }) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const person = await fetchAndAuthorizePerson(authentication, params.personId);
    if (!person) {
      return responses.notFoundResponse("Person", params.personId);
    }
    await deletePerson(params.personId);
    return responses.successResponse({ success: "Person deleted successfully" });
  } catch (error) {
    return handleErrorResponse(error);
  }
}
