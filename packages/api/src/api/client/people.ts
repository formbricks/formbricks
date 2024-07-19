import { type Result } from "@formbricks/types/error-handlers";
import { type NetworkError } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/make-request";

export class PeopleAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async create(userId: string): Promise<Result<{ userId: string }, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/people`, "POST", {
      environmentId: this.environmentId,
      userId,
    });
  }
}
