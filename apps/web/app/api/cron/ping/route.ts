import { responses } from "@/app/lib/api/response";
import packageJson from "@/package.json";
import { headers } from "next/headers";

import { prisma } from "@formbricks/database";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { captureTelemetry } from "@formbricks/lib/telemetry";

export async function POST() {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || apiKey !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const [numberOfSurveys, numberOfResponses, numberOfUsers] = await Promise.all([
    prisma.survey.count(),
    prisma.response.count(),
    prisma.user.count(),
  ]);

  captureTelemetry("ping", {
    appVersion: packageJson.version,
    surveys: numberOfSurveys,
    responses: numberOfResponses,
    users: numberOfUsers,
  });

  return responses.successResponse({}, true);
}
