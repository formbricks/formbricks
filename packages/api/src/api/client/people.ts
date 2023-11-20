import { Result } from "@formbricks/types/errorHandlers";
import { NetworkError } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/makeRequest";
import { TPerson, TPersonUpdateInput } from "@formbricks/types/people";

export class PeopleAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async create(userId: string): Promise<Result<TPerson, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/people`, "POST", {
      environmentId: this.environmentId,
      userId,
    });
  }

  async update(
    userId: string,
    personInput: TPersonUpdateInput
  ): Promise<Result<TPerson, NetworkError | Error>> {
    return makeRequest(
      this.apiHost,
      `/api/v1/client/${this.environmentId}/people/${userId}`,
      "POST",
      personInput
    );
  }
}
