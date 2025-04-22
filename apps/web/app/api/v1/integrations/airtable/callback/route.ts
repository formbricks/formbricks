import { responses } from "@/app/lib/api/response";
import { fetchAirtableAuthToken } from "@/lib/airtable/service";
import { AIRTABLE_CLIENT_ID, WEBAPP_URL } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { createOrUpdateIntegration } from "@/lib/integration/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
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

export const GET = async (req: NextRequest) => {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
  const code = queryParams.get("code");
  const session = await getServerSession(authOptions);

  if (!environmentId) {
    return responses.badRequestResponse("Invalid environmentId");
  }

  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  if (code && typeof code !== "string") {
    return responses.badRequestResponse("`code` must be a string");
  }
  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
  if (!canUserAccessEnvironment) {
    return responses.unauthorizedResponse();
  }

  const client_id = AIRTABLE_CLIENT_ID;
  const redirect_uri = WEBAPP_URL + "/api/v1/integrations/airtable/callback";
  const code_verifier = Buffer.from(environmentId + session.user.id + environmentId).toString("base64");

  if (!client_id) return responses.internalServerErrorResponse("Airtable client id is missing");
  if (!redirect_uri) return responses.internalServerErrorResponse("Airtable redirect url is missing");

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
      return responses.notFoundResponse("airtable auth token", key);
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
    return Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/airtable`);
  } catch (error) {
    logger.error({ error, url: req.url }, "Error in GET /api/v1/integrations/airtable/callback");
    responses.internalServerErrorResponse(error);
  }
  responses.badRequestResponse("unknown error occurred");
};
