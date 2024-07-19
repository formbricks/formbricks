import { type TActionInput } from "@formbricks/types/actions";
import { type Result } from "@formbricks/types/error-handlers";
import { type NetworkError } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/make-request";

export class ActionAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async create(
    actionInput: Omit<TActionInput, "environmentId">
  ): Promise<Result<object, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/actions`, "POST", actionInput);
  }
}
