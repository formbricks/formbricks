import { checkRateLimitAndThrowError } from "@/modules/api/lib/rate-limit";
import { formatZodError, handleApiError, logApiRequest } from "@/modules/api/lib/utils";
import { getEnvironmentIdFromApiKey } from "@/modules/api/management/lib/api-key";
import { hashApiKey } from "@/modules/api/management/lib/utils";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { ZodRawShape, z } from "zod";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok, okVoid } from "@formbricks/types/error-handlers";

export const authenticateRequest = async (
  request: Request
): Promise<Result<TAuthenticationApiKey, ApiErrorResponse>> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const environmentIdResult = await getEnvironmentIdFromApiKey(apiKey);
    if (!environmentIdResult.ok) {
      return err(environmentIdResult.error);
    }
    const environmentId = environmentIdResult.data;
    const hashedApiKey = hashApiKey(apiKey);
    if (environmentId) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId,
        hashedApiKey,
      };
      return ok(authentication);
    }
    return err({
      type: "forbidden",
    });
  }
  return err({
    type: "unauthorized",
  });
};

export const checkAuthorization = ({
  authentication,
  environmentId,
}: {
  authentication: TAuthenticationApiKey;
  environmentId: string;
}): Result<void, ApiErrorResponse> => {
  if (authentication.type === "apiKey" && authentication.environmentId !== environmentId) {
    return err({
      type: "unauthorized",
    });
  }
  return okVoid();
};

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
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication.ok) throw authentication.error;

    let parsedInput: ParsedSchemas<S> = {} as ParsedSchemas<S>;

    if (schemas?.body) {
      const bodyData = await request.json();
      const bodyResult = schemas.body.safeParse(bodyData);

      if (!bodyResult.success) {
        throw err({
          type: "forbidden",
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
        throw err({
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
        throw err({
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
        throw rateLimitResponse.error;
      }
    }

    return handler({
      authentication: authentication.data,
      parsedInput,
      request,
    });
  } catch (err) {
    return handleApiError(request, err);
  }
};

export const authenticatedApiClient = async <S extends ExtendedSchemas>({
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
  const startTime = Date.now();

  const response = await apiWrapper({
    request,
    schemas,
    externalParams,
    rateLimit,
    handler,
  });

  const duration = Date.now() - startTime;

  logApiRequest(request, response.status, duration);

  return response;
};
