import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

import { createPerson, getPersonByUserId, updatePerson } from "@formbricks/lib/person/service";
import { ZPersonUpdateInput } from "@formbricks/types/people";

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
    const inputValidation = ZPersonUpdateInput.safeParse(jsonInput);

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

    // If the userId is in the attributes, return an error
    if (inputValidation.data.attributes.userId) {
      return responses.badRequestResponse("Cannot update userId as an attribute");
    }

    // Check if the person is already up to date
    const updatedAtttributes = inputValidation.data.attributes;
    const oldAttributes = person.attributes;
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

    await updatePerson(person.id, inputValidation.data);

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
