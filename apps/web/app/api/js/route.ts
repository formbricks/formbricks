import { responses } from "@/app/lib/api/response";

import { WEBAPP_URL } from "@formbricks/lib/constants";

export async function GET() {
  try {
    return responses.badRequestResponse(
      "This endpoint has been deprecated. Please use the new endpoint /api/packages/<package-name>",
      {
        "x-deprecated": "true",
        "x-deprecated-date": "21-03-2024",
        "x-deprecated-redirect": `${WEBAPP_URL}/api/packages/js`,
      }
    );
  } catch (error) {
    return responses.internalServerErrorResponse("this endpoint is not available");
  }
}
