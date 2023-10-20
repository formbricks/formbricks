import { Result } from "@formbricks/types/errorHandlers";
import { NetworkError } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/makeRequest";
import { TDisplay, TDisplayCreateInput, TDisplayUpdateInput } from "@formbricks/types/displays";

export class DisplayAPI {
  private apiHost: string;

  constructor(baseUrl: string) {
    this.apiHost = baseUrl;
  }

  async create(displayInput: TDisplayCreateInput): Promise<Result<TDisplay, NetworkError | Error>> {
    return makeRequest(this.apiHost, "/api/v1/client/displays", "POST", displayInput);
  }

  async update(
    displayId: string,
    displayInput: TDisplayUpdateInput
  ): Promise<Result<TDisplay, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/displays/${displayId}`, "PUT", displayInput);
  }
}
