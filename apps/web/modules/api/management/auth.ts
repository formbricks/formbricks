import { responses } from "@/app/lib/api/response";
import { getEnvironmentIdFromApiKey } from "@/modules/api/management/lib/api-key";
import { ZodObject, ZodRawShape, z } from "zod";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

export const authenticateRequest = async (request: Request): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const environmentId = await getEnvironmentIdFromApiKey(apiKey);
    if (environmentId) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId,
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

type HandlerFn<TInput = unknown, TOutput = unknown> = ({
  authentication,
  parsedInput,
  request,
}: {
  authentication: TAuthenticationApiKey;
  parsedInput?: TInput;
  request: Request;
}) => Promise<TOutput>;

export const authenticatedAPIClient = async <T extends ZodObject<ZodRawShape>>({
  request,
  schema,
  handler,
}: {
  request: Request;
  schema?: T;
  handler: HandlerFn<z.infer<T>>;
}) => {
  const authentication = await authenticateRequest(request);
  if (!authentication) return responses.notAuthenticatedResponse();

  let parsedInput: z.infer<T> = {};

  if (schema) {
    parsedInput = schema.strict().safeParse(await request.json());

    if (!parsedInput.success) {
      return responses.badRequestResponse(parsedInput.error);
    }
  }

  return handler({
    authentication,
    ...(schema ? { parsedInput } : {}),
    request,
  });
};
