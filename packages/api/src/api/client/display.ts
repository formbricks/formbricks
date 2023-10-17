import { Result } from "@formbricks/types/v1/errorHandlers";
import { NetworkError } from "@formbricks/types/v1/errors";
import { makeRequest } from "../../utils/makeRequest";
import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";

export class DisplayAPI {
  private apiHost: string;

  constructor(baseUrl: string) {
    this.apiHost = baseUrl;
  }

  async create(displayInput: TDisplayInput): Promise<Result<TDisplay, NetworkError | Error>> {
    return makeRequest(this.apiHost, "/api/v1/client/displays", "POST", displayInput);
  }

  async update(displayId: string, displayInput: any): Promise<Result<TDisplay, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/displays/${displayId}`, "PUT", displayInput);
  }
}
