import { Result } from "@formbricks/types/errorHandlers";
import { NetworkError } from "@formbricks/types/errors";
import { TJsActionInput } from "@formbricks/types/js";
import { makeRequest } from "../../utils/makeRequest";

export class ActionAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async create(
    actionInput: Omit<TJsActionInput, "environmentId">
  ): Promise<Result<{}, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/actions`, "POST", actionInput);
  }
}
