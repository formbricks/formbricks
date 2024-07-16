import { type Result } from "@formbricks/types/error-handlers";
import { type NetworkError } from "@formbricks/types/errors";
import { type TResponseInput, type TResponseUpdateInput } from "@formbricks/types/responses";
import { makeRequest } from "../../utils/make-request";

type TResponseUpdateInputWithResponseId = TResponseUpdateInput & { responseId: string };

export class ResponseAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async create(
    responseInput: Omit<TResponseInput, "environmentId">
  ): Promise<Result<{ id: string }, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/responses`, "POST", responseInput);
  }

  async update({
    responseId,
    finished,
    data,
    ttc,
    language,
  }: TResponseUpdateInputWithResponseId): Promise<Result<object, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/${this.environmentId}/responses/${responseId}`, "PUT", {
      finished,
      data,
      ttc,
      language,
    });
  }
}
