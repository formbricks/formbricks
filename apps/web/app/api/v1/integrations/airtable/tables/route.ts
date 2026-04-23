import * as z from "zod";
import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getAirtableToken, getTables } from "@/lib/airtable/service";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getIntegrationByType } from "@/lib/integration/service";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

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

    const integration = await getIntegrationByType(environmentId, "airtable");

    if (!integration) {
      return {
        response: responses.notFoundResponse("Integration not found", environmentId),
      };
    }

    // Use getAirtableToken to ensure the access token is refreshed if expired
    const freshAccessToken = await getAirtableToken(environmentId);
    const tables = await getTables(
      { ...integration.config.key, access_token: freshAccessToken },
      baseId.data
    );
    return {
      response: responses.successResponse(tables),
    };
  },
});
