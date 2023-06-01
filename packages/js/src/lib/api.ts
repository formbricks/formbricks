import { EnvironmentId, FormbricksAPI } from "@formbricks/api";
import { Config } from "./config";

export const getApi = (): FormbricksAPI => {
  const config = Config.getInstance();
  const { environmentId, apiHost } = config.get();

  if (!environmentId || !apiHost) {
    throw new Error("formbricks.init() must be called before getApi()");
  }

  return new FormbricksAPI({
    apiHost,
    environmentId: environmentId as EnvironmentId,
  });
};
