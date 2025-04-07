import { handleApiError, logApiRequest } from "@/modules/api/v2/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ExtendedSchemas, HandlerFn, ParsedSchemas, apiWrapper } from "./api-wrapper";

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
  try {
    const response = await apiWrapper({
      request,
      schemas,
      externalParams,
      rateLimit,
      handler,
    });

    if (response.ok) {
      logApiRequest(request, response.status);
    }

    return response;
  } catch (err) {
    if ("type" in err) {
      return handleApiError(request, err as ApiErrorResponseV2);
    }

    return handleApiError(request, {
      type: "internal_server_error",
      details: [{ field: "error", issue: "An error occurred while processing your request." }],
    });
  }
};
