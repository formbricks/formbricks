import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

import { createAction } from "@formbricks/lib/action/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { ZActionInput } from "@formbricks/types/actions";

interface Context {
  params: {
    environmentId: string;
  };
}

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, context: Context): Promise<Response> {
  try {
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZActionInput.safeParse({
      ...jsonInput,
      environmentId: context.params.environmentId,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    // Formbricks Cloud: Make sure environment is part of a paid plan
    if (IS_FORMBRICKS_CLOUD) {
      const team = await getTeamByEnvironmentId(context.params.environmentId);
      if (!team || team.billing.features.userTargeting.status !== "active") {
        // temporary return status code 200 to avoid CORS issues; will be changed to 400 in the future
        return responses.successResponse({}, true);
        //return responses.badRequestResponse("Storing actions is only possible in a paid plan", {}, true);
      }
    }

    await createAction(inputValidation.data);

    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
