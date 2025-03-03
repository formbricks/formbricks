import { type TDisplayCreateInput } from "@formbricks/types/displays";
import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/make-request";

export class DisplayAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(baseUrl: string, environmentId: string) {
    this.apiHost = baseUrl;
    this.environmentId = environmentId;
  }

  async create(
    displayInput: Omit<TDisplayCreateInput, "environmentId">
  ): Promise<Result<{ id: string }, ApiErrorResponse>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/displays`, "POST", displayInput);
  }
}
