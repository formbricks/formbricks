import { ApiConfig } from "./types/index";
import { ResponsesAPI } from "./api/responses";
import { DisplaysAPI } from "./api/displays";

export class FormbricksAPI {
  responses: ResponsesAPI;
  displays: DisplaysAPI;

  constructor(options: ApiConfig) {
    const { apiHost, environmentId } = options;

    this.responses = new ResponsesAPI(apiHost);
    this.displays = new DisplaysAPI(apiHost);
  }
}
