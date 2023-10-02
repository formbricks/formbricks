import { hasUserEnvironmentAccess } from "../environment/auth";
import { getApiKey } from "./service";

export const canUserAccessApiKey = async (userId: string, apiKeyId: string): Promise<boolean> => {
  if (!userId) return false;

  const apiKeyFromServer = await getApiKey(apiKeyId);
  if (!apiKeyFromServer) return false;

  const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, apiKeyFromServer.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};
