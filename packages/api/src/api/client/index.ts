import { type ApiConfig } from "../../types";
import { EnvironmentAPI } from "./environment";
import { UserAPI } from "./user";

export class Client {
  user: UserAPI;
  environment: EnvironmentAPI;

  constructor(options: ApiConfig) {
    const { appUrl, environmentId, isDebug } = options;
    const isDebugMode = isDebug ?? false;

    this.user = new UserAPI(appUrl, environmentId, isDebugMode);
    this.environment = new EnvironmentAPI(appUrl, environmentId, isDebugMode);
  }
}
