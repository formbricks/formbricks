import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { headers } from "next/headers";

export async function POST() {
  const headersList = headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || apiKey !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const surveys = await prisma.survey.findMany({
    where: {
      status: "inProgress",
      closeOnDate: {
        lte: new Date(),
      },
    },
    select: {
      id: true,
    },
  });

  if (!surveys.length) {
    return responses.successResponse({ message: "No surveys to close" });
  }

  const mutationResp = await prisma.survey.updateMany({
    where: {
      id: {
        in: surveys.map((survey) => survey.id),
      },
    },
    data: {
      status: "completed",
    },
  });

  return responses.successResponse({
    message: `Closed ${mutationResp.count} survey(s)`,
  });
}
