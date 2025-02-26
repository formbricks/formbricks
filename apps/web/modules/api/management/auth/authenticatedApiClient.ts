import { logApiRequest } from "@/modules/api/lib/utils";
import { ExtendedSchemas, HandlerFn, ParsedSchemas, apiWrapper } from "./apiWrapper";

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
