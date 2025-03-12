import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TJsEnvironmentState } from "@formbricks/types/js";
import { makeRequest } from "../../utils/make-request";

export class EnvironmentAPI {
  private appUrl: string;
  private environmentId: string;

  constructor(appUrl: string, environmentId: string) {
    this.appUrl = appUrl;
    this.environmentId = environmentId;
  }

  async getState(): Promise<Result<TJsEnvironmentState, ApiErrorResponse>> {
    return makeRequest(this.appUrl, `/api/v1/client/${this.environmentId}/environment`, "GET");
  }
}
