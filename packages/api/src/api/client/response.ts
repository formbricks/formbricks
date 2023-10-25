import { makeRequest } from "../../utils/makeRequest";
import { NetworkError } from "@formbricks/types/errors";
import { Result } from "@formbricks/types/errorHandlers";
import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/responses";

type TResponseUpdateInputWithResponseId = TResponseUpdateInput & { responseId: string };

export class ResponseAPI {
  private apiHost: string;

  constructor(apiHost: string) {
    this.apiHost = apiHost;
  }

  async create({
    surveyId,
    personId,
    finished,
    data,
  }: TResponseInput): Promise<Result<TResponse, NetworkError | Error>> {
    return makeRequest(this.apiHost, "/api/v1/client/responses", "POST", {
      surveyId,
      personId,
      finished,
      data,
    });
  }

  async update({
    responseId,
    finished,
    data,
  }: TResponseUpdateInputWithResponseId): Promise<Result<TResponse, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/responses/${responseId}`, "PUT", {
      finished,
      data,
    });
  }
}
