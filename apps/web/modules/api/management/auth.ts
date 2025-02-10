import { checkRateLimitAndThrowError } from "@/modules/api/lib/rate-limit";
import { responses } from "@/modules/api/lib/response";
import { getEnvironmentIdFromApiKey } from "@/modules/api/management/lib/api-key";
import { hashApiKey } from "@/modules/api/management/lib/utils";
import { ZodObject, ZodRawShape, z } from "zod";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { ValidationError } from "@formbricks/types/errors";

export const authenticateRequest = async (request: Request): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const environmentId = await getEnvironmentIdFromApiKey(apiKey);
    const hashedApiKey = hashApiKey(apiKey);
    if (environmentId) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId,
        hashedApiKey,
      };
      return authentication;
    }
    return null;
  }
  return null;
};

export const checkAuthorization = ({
  authentication,
  environmentId,
}: {
  authentication: TAuthenticationApiKey;
  environmentId: string;
}) => {
  if (authentication.type === "apiKey" && authentication.environmentId !== environmentId) {
    return responses.unauthorizedResponse();
  }
  return null;
};

type HandlerFn<TInput = unknown, TOutput = Response> = ({
  authentication,
  parsedInput,
  request,
}: {
  authentication: TAuthenticationApiKey;
  parsedInput?: TInput;
  request: Request;
}) => Promise<TOutput>;

export const authenticatedApiClient = async <T extends ZodObject<ZodRawShape>>({
  request,
  schema,
  rateLimit = true,
  handler,
}: {
  request: Request;
  schema?: T;
  rateLimit?: boolean;
  handler: HandlerFn<z.infer<T>>;
}) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    let parsedInput: z.infer<T> = {};
    if (schema) {
      parsedInput = schema.strict().safeParse(await request.json());

      if (!parsedInput.success) {
        return responses.badRequestResponse(parsedInput.error);
      }
    }

    if (rateLimit) {
      console.log("rateLimit", authentication.hashedApiKey);
      const rateLimitResponse = await checkRateLimitAndThrowError({
        identifier: authentication.hashedApiKey,
      });
      console.log("rateLimitResponse", rateLimitResponse);
      if (!rateLimitResponse.ok) {
        if (rateLimitResponse.error.code === "too_many_requests") {
          return responses.tooManyRequestsResponse(rateLimitResponse.error.message);
        }
      }
    }

    return handler({
      authentication,
      ...(schema ? { parsedInput } : {}),
      request,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      // return responses.badRequestResponse(err);
    }
    // return handleErrorResponse(err);
  }
};
