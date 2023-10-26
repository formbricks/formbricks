import { responses } from "@/app/lib/api/response";
import { createSession } from "@formbricks/lib/session/service";
import { NextRequest } from "next/server";

export async function OPTIONS() {
  // cors headers

  return responses.successResponse({}, true);
}

export async function POST(req: NextRequest) {
  // we need to create a new person
  // call the createPerson service from here

  const { personId } = await req.json();

  if (!personId) {
    return responses.badRequestResponse("personId is required", { personId }, true);
  }

  try {
    const session = await createSession(personId);

    return responses.successResponse({ status: "success", session }, true);
  } catch (err) {
    return responses.internalServerErrorResponse("Something went wrong", true);
  }
}
