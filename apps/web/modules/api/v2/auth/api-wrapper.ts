import { ZodRawShape, z } from "zod";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { TApiAuditLog } from "@/app/lib/api/with-api-logging";
import { formatZodError, handleApiError } from "@/modules/api/v2/lib/utils";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
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
  bodyTransform,
  allowOrganizationOnlyApiKey = false,
}: {
  request: Request;
  schemas?: S;
  externalParams?: Promise<Record<string, any>>;
  rateLimit?: boolean;
  handler: HandlerFn<ParsedSchemas<S>>;
  auditLog?: TApiAuditLog;
  bodyTransform?: (
    body: Record<string, unknown>,
    auth: TAuthenticationApiKey
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /**
   * When true, API keys that only carry organization-level access (i.e. no workspace
   * permissions) are allowed to authenticate. Organization-scoped endpoints opt in so a
   * pure organization key can reach them; workspace-scoped routes keep this false so such
   * keys are rejected at the auth layer. See {@link authenticateApiKeyFromHeaders}.
   */
  allowOrganizationOnlyApiKey?: boolean;
}): Promise<Response> => {
  const authentication = await authenticateRequest(request, { allowOrganizationOnlyApiKey });
  if (!authentication.ok) {
    return handleApiError(request, authentication.error);
  }

  if (auditLog) {
    auditLog.userId = authentication.data.apiKeyId;
    auditLog.organizationId = authentication.data.organizationId;
  }

  let parsedInput: ParsedSchemas<S> = {} as ParsedSchemas<S>;

  if (schemas?.body) {
    let bodyData: Record<string, unknown>;
    try {
      bodyData = await parseJsonBodyWithLimit<Record<string, unknown>>(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return handleApiError(request, {
          type: "payload_too_large",
          details: [
            {
              field: "body",
              issue: error.message,
            },
          ],
        });
      }

      logger.error({ error, url: request.url }, "Error parsing JSON input");
      return handleApiError(request, {
        type: "bad_request",
        details: [
          {
            field: "error",
            issue: "Malformed JSON input, please check your request body",
          },
        ],
      });
    }

    if (bodyTransform) {
      bodyData = await bodyTransform(bodyData, authentication.data);
    }

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
      await applyRateLimit(rateLimitConfigs.api.v2, authentication.data.apiKeyId);
    } catch (error) {
      return handleApiError(request, {
        type: "too_many_requests",
        details: [
          { field: "rateLimit", issue: error instanceof Error ? error.message : "Unknown error occurred" },
        ],
      });
    }
  }

  return handler({
    authentication: authentication.data,
    parsedInput,
    request,
    auditLog,
  });
};
