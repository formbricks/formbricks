import { type ApiConfig } from "../../types";
import { AttributeAPI } from "./attribute";
import { DisplayAPI } from "./display";
import { EnvironmentAPI } from "./environment";
import { ResponseAPI } from "./response";
import { StorageAPI } from "./storage";
import { UserAPI } from "./user";

export class Client {
  response: ResponseAPI;
  display: DisplayAPI;
  storage: StorageAPI;
  attribute: AttributeAPI;
  user: UserAPI;
  environment: EnvironmentAPI;

  constructor(options: ApiConfig) {
    const { appUrl, environmentId, isDebug } = options;
    const isDebugMode = isDebug ?? false;

    this.response = new ResponseAPI(appUrl, environmentId, isDebugMode);
    this.display = new DisplayAPI(appUrl, environmentId, isDebugMode);
    this.attribute = new AttributeAPI(appUrl, environmentId, isDebugMode);
    this.storage = new StorageAPI(appUrl, environmentId);
    this.user = new UserAPI(appUrl, environmentId, isDebugMode);
    this.environment = new EnvironmentAPI(appUrl, environmentId, isDebugMode);
  }
}
