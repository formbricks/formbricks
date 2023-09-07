import { responses } from "@/lib/api/response";
import { getAuthentication } from "@/app/api/v1/auth";
import { DatabaseError } from "@formbricks/errors";
import { getPerson } from "@formbricks/lib/services/person";
import { NextResponse } from "next/server";
import { deletePerson } from "@formbricks/lib/services/person";

export async function GET(request: Request, { params }: { params: { personId: string } }
): Promise<NextResponse> {
  const authentication = await getAuthentication(request)
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const peopleId = params.personId
    const people = await getPerson(peopleId);
    if (!people) {
      return responses.notFoundResponse("People", peopleId);
    }
    return responses.successResponse(people);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { personId: string } }) {
  const peopleId = params.personId
  const authentication = await getAuthentication(request);

  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    await deletePerson(peopleId);
    return responses.successResponse({ peopleId });
  } catch (e) {
    return responses.notFoundResponse("Person", peopleId);
  }
}

function handleErrorResponse(error: any): NextResponse {
  if (error instanceof DatabaseError) {
    return responses.badRequestResponse(error.message);
  }
  return responses.notAuthenticatedResponse();
}
