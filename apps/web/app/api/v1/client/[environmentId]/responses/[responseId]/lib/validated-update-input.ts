import { TResponseUpdateInput, ZResponseUpdateInput } from "@formbricks/types/responses";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

export type TValidatedUpdateInputResult =
  | { response: Response }
  | { responseUpdateInput: TResponseUpdateInput };

export const getValidatedUpdateInput = async (req: Request): Promise<TValidatedUpdateInputResult> => {
  let responseUpdate: unknown;

  try {
    responseUpdate = await req.json();
  } catch (error) {
    return {
      response: responses.badRequestResponse(
        "Malformed JSON in request body",
        {
          error: error instanceof Error ? error.message : "Unknown error occurred",
        },
        true
      ),
    };
  }

  const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);

  if (!inputValidation.success) {
    return {
      response: responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      ),
    };
  }

  return { responseUpdateInput: inputValidation.data };
};
