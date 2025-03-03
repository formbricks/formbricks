import { responses } from "@/app/lib/api/response";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import * as z from "zod";
import { getTables } from "@formbricks/lib/airtable/service";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";

export const GET = async (req: NextRequest) => {
  const url = req.url;
  const environmentId = req.headers.get("environmentId");
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const session = await getServerSession(authOptions);
  const baseId = z.string().safeParse(queryParams.get("baseId"));

  if (!baseId.success) {
    return responses.badRequestResponse("Base Id is Required");
  }

  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is missing");
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
  if (!canUserAccessEnvironment || !environmentId) {
    return responses.unauthorizedResponse();
  }

  const integration = (await getIntegrationByType(environmentId, "airtable")) as TIntegrationAirtable;

  if (!integration) {
    return responses.notFoundResponse("Integration not found", environmentId);
  }

  const tables = await getTables(integration.config.key, baseId.data);
  return responses.successResponse(tables);
};
