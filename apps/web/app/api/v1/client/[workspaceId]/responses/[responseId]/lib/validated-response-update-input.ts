import { TResponseUpdateInput, ZResponseUpdateInput } from "@formbricks/types/responses";
import {
  TParseAndValidateJsonBodyResult,
  parseAndValidateJsonBody,
} from "@/app/lib/api/parse-and-validate-json-body";

export type TValidatedResponseUpdateInputResult =
  | { response: Response }
  | { responseUpdateInput: TResponseUpdateInput };

export const getValidatedResponseUpdateInput = async (
  req: Request
): Promise<TValidatedResponseUpdateInputResult> => {
  const validatedInput: TParseAndValidateJsonBodyResult<TResponseUpdateInput> =
    await parseAndValidateJsonBody({
      request: req,
      schema: ZResponseUpdateInput,
      malformedJsonMessage: "Malformed JSON in request body",
    });

  if ("response" in validatedInput) {
    return {
      response: validatedInput.response,
    };
  }

  return { responseUpdateInput: validatedInput.data };
};
