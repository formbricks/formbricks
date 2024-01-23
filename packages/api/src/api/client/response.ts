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
    return makeRequest(
      // "https://bbqabiq6jdvj5nwcg2mbf5vhdu0ewkrk.lambda-url.eu-central-1.on.aws/",
      // "/",
      this.apiHost,
      `/api/v1/client/${this.environmentId}/responses`,
      "POST",
      {
        ...responseInput,
      },
      {
        "x-environment-id": this.environmentId,
      }
    );
  }

  async update({
    responseId,
    finished,
    data,
    ttc,
  }: TResponseUpdateInputWithResponseId): Promise<Result<{}, NetworkError | Error>> {
    return makeRequest(
      // "https://bbqabiq6jdvj5nwcg2mbf5vhdu0ewkrk.lambda-url.eu-central-1.on.aws/",
      // "/",
      this.apiHost,
      `/api/v1/client/${this.environmentId}/responses/${responseId}`,
      "PUT",
      {
        finished,
        data,
        ttc,
      },
      {
        "x-environment-id": this.environmentId,
        "x-response-id": responseId,
      }
    );
  }
}
