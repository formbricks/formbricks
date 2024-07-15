import { FormbricksAPI } from "@formbricks/api";
import { AppConfig } from "./config";

export const getApi = (): FormbricksAPI => {
  const inAppConfig = AppConfig.getInstance();
  const { environmentId, apiHost } = inAppConfig.get();

  if (!environmentId || !apiHost) {
    throw new Error("formbricks.init() must be called before getApi()");
  }

  return new FormbricksAPI({
    apiHost,
    environmentId,
  });
};
