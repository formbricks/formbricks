import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/lib/api/response";
import { getPeople } from "@formbricks/lib/person/service";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { TPerson } from "@formbricks/types/v1/people";

export async function GET(request: Request) {
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
}

// Please use the client API to create a new person

/* export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const person: TPerson = await createPerson(authentication.environmentId);
    return responses.successResponse(person);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
} */
