import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { updateDisplay } from "@formbricks/lib/display/service";
import { ZDisplayUpdateInput } from "@formbricks/types/displays";

interface Context {
  params: {
    displayId: string;
    environmentId: string;
  };
}

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const PUT = async (request: Request, context: Context): Promise<Response> => {
  const { displayId, environmentId } = context.params;
  const jsonInput = await request.json();
  const inputValidation = ZDisplayUpdateInput.safeParse({
    ...jsonInput,
    environmentId,
  });

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  try {
    await updateDisplay(displayId, inputValidation.data);
    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(error.message, true);
  }
};
