import { Result } from "@formbricks/types/errorHandlers";
import { NetworkError } from "@formbricks/types/errors";
import { TResponseInput, TResponseUpdateInput } from "@formbricks/types/responses";

import { makeRequest } from "../../utils/makeRequest";

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
    return makeRequest("https://czzpvyzqq55l63jkxx4jzpdoh40vlcrr.lambda-url.eu-west-1.on.aws", "/", "POST", {
      ...responseInput,
      environmentId: this.environmentId,
    });
  }

  async update({
    responseId,
    finished,
    data,
    ttc,
  }: TResponseUpdateInputWithResponseId): Promise<Result<{}, NetworkError | Error>> {
    return makeRequest("https://czzpvyzqq55l63jkxx4jzpdoh40vlcrr.lambda-url.eu-west-1.on.aws", "/", "PUT", {
      environmentId: this.environmentId,
      responseId,
      finished,
      data,
      ttc,
    });
  }
}
