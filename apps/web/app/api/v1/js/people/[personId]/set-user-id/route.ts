import { getUpdatedState } from "@/app/api/v1/js/sync/lib/sync";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { prisma } from "@formbricks/database";
import { deletePerson, selectPerson, transformPrismaPerson } from "@formbricks/lib/person/service";
import { ZJsPeopleUserIdInput } from "@formbricks/types/v1/js";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, { params }): Promise<NextResponse> {
  try {
    const { personId } = params;
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsPeopleUserIdInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, userId, sessionId } = inputValidation.data;

    let returnedPerson;
    // check if person with this userId exists
    const existingPerson = await prisma.person.findFirst({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeClass: {
              name: "userId",
            },
            value: userId,
          },
        },
      },
      select: selectPerson,
    });
    // if person exists, reconnect session and delete old user
    if (existingPerson) {
      // reconnect session to new person
      await prisma.session.update({
        where: {
          id: sessionId,
        },
        data: {
          person: {
            connect: {
              id: existingPerson.id,
            },
          },
        },
      });

      // delete old person
      await deletePerson(personId);

      returnedPerson = existingPerson;
    } else {
      // update person with userId
      returnedPerson = await prisma.person.update({
        where: {
          id: personId,
        },
        data: {
          attributes: {
            create: {
              value: userId,
              attributeClass: {
                connect: {
                  name_environmentId: {
                    name: "userId",
                    environmentId,
                  },
                },
              },
            },
          },
        },
        select: selectPerson,
      });
    }

    const person = transformPrismaPerson(returnedPerson);

    if (person) {
      // revalidate person
      revalidateTag(person.id);
    }

    const state = await getUpdatedState(environmentId, person.id, sessionId);

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
