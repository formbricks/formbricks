import { checkRateLimitAndThrowError } from "@/modules/api/v2/lib/rate-limit";
import { formatZodError, handleApiError } from "@/modules/api/v2/lib/utils";
import { ZodRawShape, z } from "zod";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { authenticateRequest } from "./authenticate-request";

export type HandlerFn<TInput = Record<string, unknown>> = ({
  authentication,
  parsedInput,
  request,
}: {
  authentication: TAuthenticationApiKey;
  parsedInput: TInput;
  request: Request;
}) => Promise<Response>;

export type ExtendedSchemas = {
  body?: z.ZodObject<ZodRawShape>;
  query?: z.ZodObject<ZodRawShape>;
  params?: z.ZodObject<ZodRawShape>;
};

// Define a type that returns separate keys for each input type.
export type ParsedSchemas<S extends ExtendedSchemas | undefined> = {
  body?: S extends { body: z.ZodObject<any> } ? z.infer<S["body"]> : undefined;
  query?: S extends { query: z.ZodObject<any> } ? z.infer<S["query"]> : undefined;
  params?: S extends { params: z.ZodObject<any> } ? z.infer<S["params"]> : undefined;
};

export const apiWrapper = async <S extends ExtendedSchemas>({
  request,
  schemas,
  externalParams,
  rateLimit = true,
  handler,
}: {
  request: Request;
  schemas?: S;
  externalParams?: Promise<Record<string, any>>;
  rateLimit?: boolean;
  handler: HandlerFn<ParsedSchemas<S>>;
}): Promise<Response> => {
  const authentication = await authenticateRequest(request);
  if (!authentication.ok) {
    return handleApiError(request, authentication.error);
  }

  let parsedInput: ParsedSchemas<S> = {} as ParsedSchemas<S>;

  if (schemas?.body) {
    const bodyData = await request.json();
    const bodyResult = schemas.body.safeParse(bodyData);

    if (!bodyResult.success) {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: formatZodError(bodyResult.error),
      });
    }
    parsedInput.body = bodyResult.data as ParsedSchemas<S>["body"];
  }

  if (schemas?.query) {
    const url = new URL(request.url);
    const queryObject = Object.fromEntries(url.searchParams.entries());
    const queryResult = schemas.query.safeParse(queryObject);
    if (!queryResult.success) {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: formatZodError(queryResult.error),
      });
    }
    parsedInput.query = queryResult.data as ParsedSchemas<S>["query"];
  }

  if (schemas?.params) {
    const paramsObject = (await externalParams) || {};
    const paramsResult = schemas.params.safeParse(paramsObject);
    if (!paramsResult.success) {
      return handleApiError(request, {
        type: "unprocessable_entity",
        details: formatZodError(paramsResult.error),
      });
    }
    parsedInput.params = paramsResult.data as ParsedSchemas<S>["params"];
  }

  if (rateLimit) {
    const rateLimitResponse = await checkRateLimitAndThrowError({
      identifier: authentication.data.hashedApiKey,
    });
    if (!rateLimitResponse.ok) {
      return handleApiError(request, rateLimitResponse.error);
    }
  }

  return handler({
    authentication: authentication.data,
    parsedInput,
    request,
  });
};
