import { makeRequest } from "../utils/makeRequest";
import { NetworkError } from "../types";
import { Result } from "@formbricks/errors";
import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";

type TResponseUpdateInputWithResponseId = TResponseUpdateInput & { responseId: string };

export class ResponsesAPI {
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
