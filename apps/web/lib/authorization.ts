import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { getApiKeyFromId } from "@formbricks/lib/services/apiKey";
import { Session } from "next-auth";

export const canUserAccessApiKey = async (session: Session | null, apiKeyId: string): Promise<boolean> => {
  if (!session) return false;

  const apiKeyFromServer = await getApiKeyFromId(apiKeyId);
  if (!apiKeyFromServer) return false;

  const hasAccessToEnvironment = hasUserEnvironmentAccess(session.user.id, apiKeyFromServer.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};
