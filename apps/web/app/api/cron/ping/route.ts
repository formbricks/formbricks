import { responses } from "@/app/lib/api/response";
import { headers } from "next/headers";

import { CRON_SECRET } from "@formbricks/lib/constants";
import { captureTelemetry } from "@formbricks/lib/telemetry";

export async function POST() {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || apiKey !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  captureTelemetry("ping");

  return responses.successResponse({}, true);
}
