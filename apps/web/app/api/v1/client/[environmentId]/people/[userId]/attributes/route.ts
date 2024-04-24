import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";

import { getAttributesByUserId, updateAttributes } from "@formbricks/lib/attribute/service";
import { getPersonByUserId } from "@formbricks/lib/person/service";
import { ZJsPeopleUpdateAttributeInput } from "@formbricks/types/js";

export async function OPTIONS() {
  // cors headers
  return responses.successResponse({}, true);
}

export async function PUT(req: NextRequest, context: { params: { environmentId: string; userId: string } }) {
  try {
    const environmentId = context.params.environmentId;
    if (!environmentId) {
      return responses.badRequestResponse("environmentId is required", { environmentId }, true);
    }

    const userId = context.params.userId;
    if (!userId) {
      return responses.badRequestResponse("userId is required", { userId }, true);
    }

    const jsonInput = await req.json();

    const parsedInput = ZJsPeopleUpdateAttributeInput.safeParse(jsonInput);
    if (!parsedInput.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(parsedInput.error),
        true
      );
    }

    const { userId: userIdAttr, ...updatedAttributes } = parsedInput.data.attributes;

    const person = await getPersonByUserId(environmentId, userId);
    if (!person) {
      return responses.notFoundResponse("Person not found", "personId");
    }

    const oldAttributes = await getAttributesByUserId(environmentId, userId);

    let isUpToDate = true;
    for (const key in updatedAttributes) {
      if (updatedAttributes[key] !== oldAttributes[key]) {
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

    await updateAttributes(person.id, updatedAttributes);

    return responses.successResponse(
      {
        changed: true,
        message: "The person was successfully updated.",
      },
      true
    );
  } catch (err) {
    return responses.internalServerErrorResponse("Something went wrong", true);
  }
}
