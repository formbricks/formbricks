import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { deletePerson, getPerson } from "@formbricks/lib/person/service";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { TPerson } from "@formbricks/types/people";

// Please use the methods provided by the client API to update a person

const fetchAndAuthorizePerson = async (
  authentication: TAuthenticationApiKey,
  personId: string
): Promise<TPerson | null> => {
  const person = await getPerson(personId);
  if (!person) {
    return null;
  }
  if (person.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return person;
};

export const GET = async (
  request: Request,
  { params }: { params: { personId: string } }
): Promise<Response> => {
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
};

export const DELETE = async (request: Request, { params }: { params: { personId: string } }) => {
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
};
