import { hasUserEnvironmentAccess } from "../environment/auth";
import { Session } from "next-auth";
import { getApiKey } from "./service";

export const canUserAccessApiKey = async (user: Session["user"], apiKeyId: string): Promise<boolean> => {
  if (!user) return false;

  const apiKeyFromServer = await getApiKey(apiKeyId);
  if (!apiKeyFromServer) return false;

  const hasAccessToEnvironment = await hasUserEnvironmentAccess(user, apiKeyFromServer.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};
