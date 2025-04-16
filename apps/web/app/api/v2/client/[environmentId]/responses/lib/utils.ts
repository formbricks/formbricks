import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { logger } from "@formbricks/logger";
import { ZIP } from "@formbricks/types/common";

export function extractIP(requestHeaders: ReadonlyHeaders, surveyId: string): string | undefined {
  let ipValidationData: string | undefined = undefined;
  const ip =
    requestHeaders.get("x-forwarded-for") ||
    requestHeaders.get("x-vercel-forwarded-for") ||
    requestHeaders.get("CF-Connecting-IP") ||
    requestHeaders.get("True-Client-IP") ||
    undefined;

  const ipAddress = ip?.split(",")[0];
  const ipValidation = ZIP.safeParse(ipAddress);

  if (ipValidation.success && ipValidation.data) {
    ipValidationData = ipValidation.data;
  } else {
    logger.warn(`Not able to capture IP address for survey: ${surveyId}`);
  }
  return ipValidationData;
}
