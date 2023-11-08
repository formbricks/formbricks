import { makeRequest } from "../../utils/makeRequest";
import { NetworkError } from "@formbricks/types/errors";
import { Result } from "@formbricks/types/errorHandlers";
import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/responses";

type TResponseUpdateInputWithResponseId = TResponseUpdateInput & { responseId: string };

export class ResponseAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async create(responseInput: TResponseInput): Promise<Result<TResponse, NetworkError | Error>> {
    console.log(this);
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/responses`, "POST", responseInput);
  }

  async update({
    responseId,
    finished,
    data,
  }: TResponseUpdateInputWithResponseId): Promise<Result<TResponse, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/responses/${responseId}`, "PUT", {
      finished,
      data,
    });
  }
}
