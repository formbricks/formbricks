// Deprecated since 2024-04-13
// last supported js version 1.6.5
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { z } from "zod";

import { getAttributesByUserId, updateAttributes } from "@formbricks/lib/attribute/service";
import { createPerson, getPersonByUserId } from "@formbricks/lib/person/service";
import { ZAttributes } from "@formbricks/types/attributes";

interface Context {
  params: {
    userId: string;
    environmentId: string;
  };
}

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, context: Context): Promise<Response> {
  try {
    const { userId, environmentId } = context.params;
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = z.object({ attributes: ZAttributes }).safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    let person = await getPersonByUserId(environmentId, userId);

    if (!person) {
      // return responses.notFoundResponse("PersonByUserId", userId, true);
      // HOTFIX: create person if not found to work around caching issue
      person = await createPerson(environmentId, userId);
    }

    // Check if the person is already up to date
    const updatedAtttributes = inputValidation.data.attributes;
    const oldAttributes = await getAttributesByUserId(environmentId, userId);

    let isUpToDate = true;
    for (const key in updatedAtttributes) {
      if (updatedAtttributes[key] !== oldAttributes[key]) {
        isUpToDate = false;
        break;
      }
    }

    if (isUpToDate) {
      return responses.successResponse(
        {
          changed: false,
          message: "No updates were necessary; the person is already up to date.",
        },
        true
      );
    }

    await updateAttributes(person.id, inputValidation.data.attributes);

    return responses.successResponse(
      {
        changed: true,
        message: "The person was successfully updated.",
      },
      true
    );
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete request: ${error.message}`, true);
  }
}
