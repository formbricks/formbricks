import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { authenticateApiKey } from "@/app/api/v1/auth";
import { buildApiKeyMeResponse } from "@/app/api/v1/management/me/lib/api-key-response";
import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { responses } from "@/app/lib/api/response";
import { publicUserSelect } from "@/lib/user/public-user";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const checkRateLimit = async (userId: string) => {
  try {
    await applyRateLimit(rateLimitConfigs.api.v1, userId);
  } catch (error) {
    return responses.tooManyRequestsResponse(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
  return null;
};

const handleApiKeyAuthentication = async (apiKey: string) => {
  const authentication = await authenticateApiKey(apiKey, { allowOrganizationOnlyApiKey: true });

  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  const rateLimitError = await checkRateLimit(authentication.apiKeyId);
  if (rateLimitError) return rateLimitError;

  const apiKeyMeResponse = await buildApiKeyMeResponse(authentication);

  if (!apiKeyMeResponse) {
    return responses.badRequestResponse("You can't use this method with this API key");
  }

  return apiKeyMeResponse;
};

const handleSessionAuthentication = async () => {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return responses.notAuthenticatedResponse();
  }

  const rateLimitError = await checkRateLimit(sessionUser.id);
  if (rateLimitError) return rateLimitError;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: publicUserSelect,
  });

  return Response.json(user);
};

export const GET = async () => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");

  if (apiKey) {
    return handleApiKeyAuthentication(apiKey);
  }

  return handleSessionAuthentication();
};
