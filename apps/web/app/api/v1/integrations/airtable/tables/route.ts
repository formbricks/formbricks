import { responses } from "@/app/lib/api/response";
import { TSessionAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getTables } from "@/lib/airtable/service";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getIntegrationByType } from "@/lib/integration/service";
import { NextRequest } from "next/server";
import * as z from "zod";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";

export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    authentication,
  }: {
    req: NextRequest;
    authentication: NonNullable<TSessionAuthentication>;
  }) => {
    const url = req.url;
    const environmentId = req.headers.get("environmentId");
    const queryParams = new URLSearchParams(url.split("?")[1]);
    const baseId = z.string().safeParse(queryParams.get("baseId"));

    if (!baseId.success) {
      return {
        response: responses.badRequestResponse("Base Id is Required"),
      };
    }

    if (!environmentId) {
      return {
        response: responses.badRequestResponse("environmentId is missing"),
      };
    }

    const canUserAccessEnvironment = await hasUserEnvironmentAccess(authentication.user.id, environmentId);
    if (!canUserAccessEnvironment) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    const integration = (await getIntegrationByType(environmentId, "airtable")) as TIntegrationAirtable;

    if (!integration) {
      return {
        response: responses.notFoundResponse("Integration not found", environmentId),
      };
    }

    const tables = await getTables(integration.config.key, baseId.data);
    return {
      response: responses.successResponse(tables),
    };
  },
});
