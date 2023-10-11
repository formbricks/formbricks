import { ResponseAPI } from "./response";
import { DisplayAPI } from "./display";
import { ApiConfig } from "../../types";

export class Client {
  response: ResponseAPI;
  display: DisplayAPI;

  constructor(options: ApiConfig) {
    const { apiHost } = options;

    this.response = new ResponseAPI(apiHost);
    this.display = new DisplayAPI(apiHost);
  }
}
