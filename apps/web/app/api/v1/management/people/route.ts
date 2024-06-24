import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { getPeople } from "@formbricks/lib/person/service";
import { DatabaseError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const people: TPerson[] = await getPeople(authentication.environmentId!);
    return responses.successResponse(people);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

// Please use the client API to create a new person
