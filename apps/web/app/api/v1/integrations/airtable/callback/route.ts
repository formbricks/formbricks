import { responses } from "@/app/lib/api/response";
import { TSessionAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { fetchAirtableAuthToken } from "@/lib/airtable/service";
import { AIRTABLE_CLIENT_ID, WEBAPP_URL } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { createOrUpdateIntegration } from "@/lib/integration/service";
import { NextRequest } from "next/server";
import * as z from "zod";
import { logger } from "@formbricks/logger";

const getEmail = async (token: string) => {
  const req_ = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const res_ = await req_.json();

  return z.string().parse(res_?.email);
};

export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    authentication,
  }: {
    req: NextRequest;
    authentication: NonNullable<TSessionAuthentication>;
  }) => {
    const url = req.url;
    const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
    const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
    const code = queryParams.get("code");

    if (!environmentId) {
      return {
        response: responses.badRequestResponse("Invalid environmentId"),
      };
    }

    if (!code) {
      return {
        response: responses.badRequestResponse("`code` is missing"),
      };
    }
    const canUserAccessEnvironment = await hasUserEnvironmentAccess(authentication.user.id, environmentId);
    if (!canUserAccessEnvironment) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    const client_id = AIRTABLE_CLIENT_ID;
    const redirect_uri = WEBAPP_URL + "/api/v1/integrations/airtable/callback";
    const code_verifier = Buffer.from(environmentId + authentication.user.id + environmentId).toString(
      "base64"
    );

    if (!client_id)
      return {
        response: responses.internalServerErrorResponse("Airtable client id is missing"),
      };

    const formData = {
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id,
      code_verifier,
    };

    try {
      const key = await fetchAirtableAuthToken(formData);
      if (!key) {
        return {
          response: responses.notFoundResponse("airtable auth token", key),
        };
      }
      const email = await getEmail(key.access_token);

      const airtableIntegrationInput = {
        type: "airtable" as "airtable",
        environment: environmentId,
        config: {
          key,
          data: [],
          email,
        },
      };
      await createOrUpdateIntegration(environmentId, airtableIntegrationInput);
      return {
        response: Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/airtable`),
      };
    } catch (error) {
      logger.error({ error, url: req.url }, "Error in GET /api/v1/integrations/airtable/callback");
      return {
        response: responses.internalServerErrorResponse(error),
      };
    }
  },
});
