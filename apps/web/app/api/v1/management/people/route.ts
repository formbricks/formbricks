import { responses } from "@/lib/api/response";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { authenticateRequest } from "@/app/api/v1/auth";
import { getPeople, createPerson } from "@formbricks/lib/services/person";
import { TPerson } from "@formbricks/types/v1/people";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      return responses.notAuthenticatedResponse();
    }
    const people: TPerson[] = await getPeople(authentication.environmentId!);
    return responses.successResponse(people);
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

    const person: TPerson = await createPerson(authentication.environmentId);
    return responses.successResponse(person);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
