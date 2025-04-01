import { type TDisplayCreateInput } from "@formbricks/types/displays";
import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/make-request";

export class DisplayAPI {
  private appUrl: string;
  private environmentId: string;
  private isDebug: boolean;

  constructor(appUrl: string, environmentId: string, isDebug: boolean) {
    this.appUrl = appUrl;
    this.environmentId = environmentId;
    this.isDebug = isDebug;
  }

  async create(
    displayInput: Omit<TDisplayCreateInput, "environmentId">
  ): Promise<Result<{ id: string }, ApiErrorResponse>> {
    return makeRequest(
      this.appUrl,
      `/api/v1/client/${this.environmentId}/displays`,
      "POST",
      displayInput,
      this.isDebug
    );
  }
}
