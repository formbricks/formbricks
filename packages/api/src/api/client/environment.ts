import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TJsEnvironmentState } from "@formbricks/types/js";
import { makeRequest } from "../../utils/make-request";

export class EnvironmentAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async getState(): Promise<Result<TJsEnvironmentState, ApiErrorResponse>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/environment`, "GET");
  }
}
