import { ResponseAPI } from "./response";
import { DisplayAPI } from "./display";
import { ApiConfig } from "../../types";

export class Client {
  response: ResponseAPI;
  display: DisplayAPI;

  constructor(options: ApiConfig) {
    const { apiHost, environmentId } = options;

    this.response = new ResponseAPI(apiHost, environmentId);
    this.display = new DisplayAPI(apiHost, environmentId);
  }
}
