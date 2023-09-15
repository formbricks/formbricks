import { getSurveys } from "@/app/api/v1/js/surveys";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { prisma } from "@formbricks/database";
import { getActionClasses } from "@formbricks/lib/services/actionClass";
import { getPerson, selectPerson, transformPrismaPerson } from "@formbricks/lib/services/person";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { extendSession } from "@formbricks/lib/services/session";
import { TJsState, ZJsPeopleAttributeInput } from "@formbricks/types/v1/js";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, { params }): Promise<NextResponse> {
  try {
    const { personId } = params;
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsPeopleAttributeInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, sessionId, key, value } = inputValidation.data;

    const existingPerson = await getPerson(personId);

    if (!existingPerson) {
      return responses.notFoundResponse("Person", personId, true);
    }

    // find attribute class
    let attributeClass = await prisma.attributeClass.findUnique({
      where: {
        name_environmentId: {
          name: key,
          environmentId,
        },
      },
      select: {
        id: true,
      },
    });

    // create new attribute class if not found
    if (attributeClass === null) {
      attributeClass = await prisma.attributeClass.create({
        data: {
          name: key,
          type: "code",
          environment: {
            connect: {
              id: environmentId,
            },
          },
        },
        select: {
          id: true,
        },
      });
    }

    // upsert attribute (update or create)
    const attribute = await prisma.attribute.upsert({
      where: {
        attributeClassId_personId: {
          attributeClassId: attributeClass.id,
          personId,
        },
      },
      update: {
        value,
      },
      create: {
        attributeClass: {
          connect: {
            id: attributeClass.id,
          },
        },
        person: {
          connect: {
            id: personId,
          },
        },
        value,
      },
      select: {
        person: {
          select: selectPerson,
        },
      },
    });

    const person = transformPrismaPerson(attribute.person);

    // get/create rest of the state
    const [session, surveys, noCodeActionClasses, product] = await Promise.all([
      extendSession(sessionId),
      getSurveys(environmentId, person),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!product) {
      return responses.notFoundResponse("ProductByEnvironmentId", environmentId, true);
    }

    // revalidate person
    revalidateTag(personId);

    // return state
    const state: TJsState = {
      person,
      session,
      surveys,
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product,
    };
    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
