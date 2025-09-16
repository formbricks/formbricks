import { responses } from "@/modules/api/v2/lib/response";
import { performHealthChecks } from "./lib/health-checks";

export const GET = async () => {
  const healthStatusResult = await performHealthChecks();
  if (!healthStatusResult.ok) {
    return responses.serviceUnavailableResponse({
      details: healthStatusResult.error.details,
    });
  }

  return responses.successResponse({
    data: healthStatusResult.data,
  });
};
