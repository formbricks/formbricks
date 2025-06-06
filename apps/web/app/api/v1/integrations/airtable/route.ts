import { responses } from "@/app/lib/api/response";
import { AIRTABLE_CLIENT_ID, WEBAPP_URL } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

const scope = `data.records:read data.records:write schema.bases:read schema.bases:write user.email:read`;

export const GET = async (req: NextRequest) => {
  const environmentId = req.headers.get("environmentId");
  const session = await getServerSession(authOptions);

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is missing");
  }

  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
  if (!canUserAccessEnvironment) {
    return responses.unauthorizedResponse();
  }

  const client_id = AIRTABLE_CLIENT_ID;
  const redirect_uri = WEBAPP_URL + "/api/v1/integrations/airtable/callback";
  if (!client_id) return responses.internalServerErrorResponse("Airtable client id is missing");
  if (!redirect_uri) return responses.internalServerErrorResponse("Airtable redirect url is missing");
  const codeVerifier = Buffer.from(environmentId + session.user.id + environmentId).toString("base64");

  const codeChallengeMethod = "S256";
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier) // hash the code verifier with the sha256 algorithm
    .digest("base64") // base64 encode, needs to be transformed to base64url
    .replace(/=/g, "") // remove =
    .replace(/\+/g, "-") // replace + with -
    .replace(/\//g, "_"); // replace / with _ now base64url encoded

  const authUrl = new URL("https://airtable.com/oauth2/v1/authorize");

  authUrl.searchParams.append("client_id", client_id);
  authUrl.searchParams.append("redirect_uri", redirect_uri);
  authUrl.searchParams.append("state", environmentId);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("code_challenge_method", codeChallengeMethod);
  authUrl.searchParams.append("code_challenge", codeChallenge);

  return responses.successResponse({ authUrl: authUrl.toString() });
};
