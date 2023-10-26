import { responses } from "@/app/lib/api/response";
import { createPerson } from "@formbricks/lib/person/service";
import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getSurveysCacheTag } from "@formbricks/lib/survey/service";

export async function OPTIONS() {
  // cors headers

  return responses.successResponse({}, true);
}

export async function POST(req: NextRequest) {
  // we need to create a new person
  // call the createPerson service from here

  const { environmentId } = await req.json();

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is required", { environmentId }, true);
  }

  try {
    const person = await createPerson(environmentId);

    if (person) {
      // revalidate the cache
      revalidateTag(getSurveysCacheTag(environmentId));
    }

    return responses.successResponse({ status: "success", person }, true);
  } catch (err) {
    return responses.internalServerErrorResponse("Something went wrong", true);
  }
}
