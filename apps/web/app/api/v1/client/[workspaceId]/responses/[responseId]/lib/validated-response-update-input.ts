import { TClientResponseUpdateInput, ZClientResponseUpdateInput } from "@formbricks/types/responses";
import {
  TParseAndValidateJsonBodyResult,
  parseAndValidateJsonBody,
} from "@/app/lib/api/parse-and-validate-json-body";

export type TValidatedResponseUpdateInputResult =
  | { response: Response }
  | { responseUpdateInput: TClientResponseUpdateInput };

export const getValidatedResponseUpdateInput = async (
  req: Request
): Promise<TValidatedResponseUpdateInputResult> => {
  const validatedInput: TParseAndValidateJsonBodyResult<TClientResponseUpdateInput> =
    await parseAndValidateJsonBody({
      request: req,
      // The survey's update input: `ZResponseUpdateInput` plus Mark as low quality (ENG-6933) and the
      // not-shown record (ENG-6936).
      schema: ZClientResponseUpdateInput,
      malformedJsonMessage: "Malformed JSON in request body",
    });

  if ("response" in validatedInput) {
    return {
      response: validatedInput.response,
    };
  }

  return { responseUpdateInput: validatedInput.data };
};
