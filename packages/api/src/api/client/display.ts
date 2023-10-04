import { Result } from "@formbricks/types/v1/errorHandlers";
import { NetworkError } from "@formbricks/types/v1/errors";
import { makeRequest } from "../../utils/makeRequest";
import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";

export class DisplayAPI {
  private apiHost: string;

  constructor(baseUrl: string) {
    this.apiHost = baseUrl;
  }

  async markDisplayedForPerson({
    surveyId,
    personId,
  }: TDisplayInput): Promise<Result<TDisplay, NetworkError | Error>> {
    return makeRequest(this.apiHost, "/api/v1/client/displays", "POST", { surveyId, personId });
  }

  async markResponded({ displayId }: { displayId: string }): Promise<Result<TDisplay, NetworkError | Error>> {
    return makeRequest(this.apiHost, `/api/v1/client/displays/${displayId}/responded`, "POST");
  }
}
