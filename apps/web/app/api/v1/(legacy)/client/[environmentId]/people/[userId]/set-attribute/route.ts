import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { updateAttributes } from "@formbricks/lib/attribute/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { personCache } from "@formbricks/lib/person/cache";
import { getPerson } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getSyncSurveys } from "@formbricks/lib/survey/service";
import { ZJsPeopleAttributeInput } from "@formbricks/types/js";

interface Context {
  params: {
    userId: string;
    environmentId: string;
  };
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (req: Request, context: Context): Promise<Response> => {
  try {
    const { userId, environmentId } = context.params;
    const personId = userId; // legacy workaround for formbricks-js 1.2.0 & 1.2.1
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

    const { key, value } = inputValidation.data;

    const person = await getPerson(personId);

    if (!person) {
      return responses.notFoundResponse("Person", personId, true);
    }

    await updateAttributes(personId, { [key]: value });

    personCache.revalidate({
      id: personId,
      environmentId,
    });

    surveyCache.revalidate({
      environmentId,
    });

    const organization = await getOrganizationByEnvironmentId(environmentId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const [surveys, noCodeActionClasses, product] = await Promise.all([
      getSyncSurveys(environmentId, person.id),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!product) {
      throw new Error("Product not found");
    }

    // return state
    const state = {
      person: { id: person.id, userId: person.userId },
      surveys,
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product,
    };

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete request: ${error.message}`, true);
  }
};
