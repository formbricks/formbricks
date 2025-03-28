import { logApiRequest } from "@/modules/api/v2/lib/utils";
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
};
