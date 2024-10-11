// DEPRECATED - This file is deprecated and will be removed in the future
// Deprecated since 22-03-2024
// This endpoint has been deprecated. Please use the new endpoint /js/formbricks.umd.cjs instead.
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@formbricks/lib/constants";

export const GET = async () => {
  try {
    return responses.goneResponse(
      "This endpoint has been deprecated. Please use the new endpoint /js/formbricks.umd.cjs instead.",
      {
        "x-deprecated": "true",
        "x-deprecated-date": "22-03-2024",
        "x-deprecated-redirect": `${WEBAPP_URL}/js/formbricks.umd.cjs`,
      },
      true
    );
  } catch (error) {
    return responses.internalServerErrorResponse("this endpoint is not available");
  }
};
