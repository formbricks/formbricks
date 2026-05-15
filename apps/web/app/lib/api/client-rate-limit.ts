import { ZEnvironmentId } from "@formbricks/types/environment";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { responses } from "@/app/lib/api/response";
import { applyClientRateLimit } from "@/modules/core/rate-limit/helpers";
import { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";

const rateLimitMessage = "Maximum number of requests reached. Please try again later.";
const unexpectedErrorMessage = "Something went wrong. Please try again.";

export const validateClientEnvironmentId = (environmentId: string): string | null => {
  const environmentIdValidation = ZEnvironmentId.safeParse(environmentId);
  return environmentIdValidation.success ? environmentIdValidation.data : null;
};

export const getInvalidClientEnvironmentIdResponse = (cors = true): Response => {
  return responses.badRequestResponse("Invalid environment ID format", undefined, cors);
};

export const isTooManyRequestsError = (error: unknown): boolean => {
  return (
    error instanceof TooManyRequestsError || (error instanceof Error && error.name === "TooManyRequestsError")
  );
};

export const getRateLimitErrorResponse = ({
  request,
  error,
  cors = true,
}: {
  request: Request;
  error: unknown;
  cors?: boolean;
}): Response => {
  if (isTooManyRequestsError(error)) {
    return responses.tooManyRequestsResponse(rateLimitMessage, cors);
  }

  const response = responses.internalServerErrorResponse(unexpectedErrorMessage, cors);
  reportApiError({
    request,
    status: response.status,
    error,
  });
  return response;
};

export const applyClientApiRateLimit = async ({
  request,
  environmentId,
  customRateLimitConfig,
  cors = true,
}: {
  request: Request;
  environmentId: string;
  customRateLimitConfig?: TRateLimitConfig;
  cors?: boolean;
}): Promise<Response | null> => {
  const validEnvironmentId = validateClientEnvironmentId(environmentId);
  if (!validEnvironmentId) {
    return getInvalidClientEnvironmentIdResponse(cors);
  }

  try {
    await applyClientRateLimit(validEnvironmentId, customRateLimitConfig);
    return null;
  } catch (error) {
    return getRateLimitErrorResponse({ request, error, cors });
  }
};
