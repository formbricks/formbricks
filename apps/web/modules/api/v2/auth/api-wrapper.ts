import { TApiAuditLog } from "@/app/lib/api/with-api-logging";
import { formatZodError, handleApiError } from "@/modules/api/v2/lib/utils";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ZodRawShape, z } from "zod";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { authenticateRequest } from "./authenticate-request";

export type HandlerFn<TInput = Record<string, unknown>> = ({
  authentication,
  parsedInput,
  request,
  auditLog,
}: {
  authentication: TAuthenticationApiKey;
  parsedInput: TInput;
  request: Request;
  auditLog?: TApiAuditLog;
}) => Promise<Response>;

export type ExtendedSchemas = {
  body?: z.ZodObject<ZodRawShape>;
  query?: z.ZodObject<ZodRawShape>;
  params?: z.ZodObject<ZodRawShape>;
};

// Define a type that returns separate keys for each input type.
// It uses mapped types to create a new type based on the input schemas.
// It checks if each schema is defined and if it is a ZodObject, then infers the type from it.
// It also uses conditional types to ensure that the keys are only included if the schema is defined and valid.
// This allows for more flexibility and type safety when working with the input schemas.
export type ParsedSchemas<S extends ExtendedSchemas | undefined> = S extends object
  ? {
      [K in keyof S as NonNullable<S[K]> extends z.ZodObject<any> ? K : never]: NonNullable<
        S[K]
      > extends z.ZodObject<any>
        ? z.infer<NonNullable<S[K]>>
        : never;
    }
  : {};

export const apiWrapper = async <S extends ExtendedSchemas>({
  request,
  schemas,
  externalParams,
  rateLimit = true,
  handler,
  auditLog,
}: {
  request: Request;
  schemas?: S;
  externalParams?: Promise<Record<string, any>>;
  rateLimit?: boolean;
  handler: HandlerFn<ParsedSchemas<S>>;
  auditLog?: TApiAuditLog;
}): Promise<Response> => {
  const authentication = await authenticateRequest(request);
  if (!authentication.ok) {
    return handleApiError(request, authentication.error);
  }

  if (auditLog) {
    auditLog.userId = authentication.data.apiKeyId;
    auditLog.organizationId = authentication.data.organizationId;
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
    try {
      await applyRateLimit(rateLimitConfigs.api.v2, authentication.data.hashedApiKey);
    } catch (error) {
      return handleApiError(request, { type: "too_many_requests", details: error.message });
    }
  }

  return handler({
    authentication: authentication.data,
    parsedInput,
    request,
    auditLog,
  });
};
