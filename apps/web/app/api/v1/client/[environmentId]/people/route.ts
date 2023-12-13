import { responses } from "@/app/lib/api/response";
import { createPerson } from "@formbricks/lib/person/service";
import { NextRequest } from "next/server";
interface Context {
  params: {
    environmentId: string;
  };
}

export async function OPTIONS() {
  // cors headers

  return responses.successResponse({}, true);
}

export async function POST(req: NextRequest, context: Context) {
  // we need to create a new person
  // call the createPerson service from here
  const environmentId = context.params.environmentId;
  const { userId } = await req.json();

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is required", { environmentId }, true);
  }

  if (!userId) {
    return responses.badRequestResponse("userId is required", { environmentId }, true);
  }

  try {
    await createPerson(environmentId, userId);

    return responses.successResponse({ userId }, true);
  } catch (err) {
    return responses.internalServerErrorResponse("Something went wrong", true);
  }
}
