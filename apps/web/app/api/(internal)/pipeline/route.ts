import { headers } from "next/headers";
import { logger } from "@formbricks/logger";
import { responses } from "@/app/lib/api/response";
import { drainPipelineQueue } from "@/app/lib/pipeline-queue";
import { CRON_SECRET } from "@/lib/constants";
import { processPipelineJob } from "./lib/processor";

export const POST = async (request: Request) => {
  const requestHeaders = await headers();

  if (requestHeaders.get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  try {
    const result = await drainPipelineQueue({
      processJob: processPipelineJob,
    });

    return responses.successResponse(result);
  } catch (error) {
    logger.error({ error, url: request.url }, "Error draining pipeline queue");
    return responses.internalServerErrorResponse("Failed to drain pipeline queue");
  }
};
