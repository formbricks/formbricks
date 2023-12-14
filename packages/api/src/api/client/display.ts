import { TDisplayCreateInput, TDisplayUpdateInput } from "@formbricks/types/displays";
import { Result } from "@formbricks/types/errorHandlers";
import { NetworkError } from "@formbricks/types/errors";

import { makeRequest } from "../../utils/makeRequest";

export class DisplayAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(baseUrl: string, environmentId: string) {
    this.apiHost = baseUrl;
    this.environmentId = environmentId;
  }

  async create(
    displayInput: Omit<TDisplayCreateInput, "environmentId">
  ): Promise<Result<{ id: string }, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/displays`, "POST", displayInput);
  }

  async update(
    displayId: string,
    displayInput: Omit<TDisplayUpdateInput, "environmentId">
  ): Promise<Result<{}, NetworkError | Error>> {
    return makeRequest(
      this.apiHost,
      `/api/v1/client/${this.environmentId}/displays/${displayId}`,
      "PUT",
      displayInput
    );
  }
}
