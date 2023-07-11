import { getSurveys } from "./surveys";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { createPerson } from "@formbricks/lib/services/person";
import { createSession } from "@formbricks/lib/services/session";
import { TJsState, ZJsSyncInput } from "@formbricks/types/v1/js";
import { NextResponse } from "next/server";

export async function POST(req: Request): Promise<NextResponse> {
  const jsonInput = await req.json();

  // validate using zod
  const inputValidation = ZJsSyncInput.safeParse(jsonInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { environmentId, personId, sessionId } = inputValidation.data;

  if (!personId) {
    // create a new person
    const person = await createPerson(environmentId);
    // create a session
    const session = await createSession(person.id);
    const surveys = await getSurveys(environmentId, person);
    // return state
    const state: TJsState = {
      person,
      session,
      surveys,
    };
    return responses.successResponse({ state }, true);
  }

  if (!sessionId) {
    // find person and return state
    return responses.successResponse({}, true);
  }

  // find person and session and check if session is still valid
  // return state
  return responses.successResponse({}, true);
}
