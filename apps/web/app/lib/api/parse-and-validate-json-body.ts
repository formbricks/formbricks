import { z } from "zod";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

type TJsonBodyValidationIssue = "invalid_json" | "invalid_body";

type TJsonBodyValidationError = {
  details: Record<string, string> | { error: string };
  issue: TJsonBodyValidationIssue;
  response: Response;
};

type TJsonBodyValidationSuccess<TData> = {
  data: TData;
};

export type TParseAndValidateJsonBodyResult<TData> =
  | TJsonBodyValidationError
  | TJsonBodyValidationSuccess<TData>;

type TParseAndValidateJsonBodyOptions<TSchema extends z.ZodTypeAny> = {
  request: Request;
  schema: TSchema;
  buildInput?: (jsonInput: unknown) => unknown;
  malformedJsonMessage?: string;
  validationMessage?: string;
};

const DEFAULT_MALFORMED_JSON_MESSAGE = "Malformed JSON input, please check your request body";
const DEFAULT_VALIDATION_MESSAGE = "Fields are missing or incorrectly formatted";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error occurred";

export const parseAndValidateJsonBody = async <TSchema extends z.ZodTypeAny>({
  request,
  schema,
  buildInput,
  malformedJsonMessage = DEFAULT_MALFORMED_JSON_MESSAGE,
  validationMessage = DEFAULT_VALIDATION_MESSAGE,
}: TParseAndValidateJsonBodyOptions<TSchema>): Promise<
  TParseAndValidateJsonBodyResult<z.output<TSchema>>
> => {
  let jsonInput: unknown;

  try {
    jsonInput = await request.json();
  } catch (error) {
    const details = { error: getErrorMessage(error) };

    return {
      details,
      issue: "invalid_json",
      response: responses.badRequestResponse(malformedJsonMessage, details, true),
    };
  }

  const inputValidation = schema.safeParse(buildInput ? buildInput(jsonInput) : jsonInput);

  if (!inputValidation.success) {
    const details = transformErrorToDetails(inputValidation.error);

    return {
      details,
      issue: "invalid_body",
      response: responses.badRequestResponse(validationMessage, details, true),
    };
  }

  return { data: inputValidation.data };
};
