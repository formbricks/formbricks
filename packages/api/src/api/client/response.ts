import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TResponseInput, type TResponseUpdateInput } from "@formbricks/types/responses";
import { makeRequest } from "../../utils/make-request";

type TResponseUpdateInputWithResponseId = TResponseUpdateInput & { responseId: string };

export class ResponseAPI {
  private appUrl: string;
  private environmentId: string;
  private isDebug: boolean;
  constructor(appUrl: string, environmentId: string, isDebug: boolean) {
    this.appUrl = appUrl;
    this.environmentId = environmentId;
    this.isDebug = isDebug;
  }

  async create(
    responseInput: Omit<TResponseInput, "environmentId">
  ): Promise<Result<{ id: string }, ApiErrorResponse>> {
    return makeRequest(
      this.appUrl,
      `/api/v1/client/${this.environmentId}/responses`,
      "POST",
      responseInput,
      this.isDebug
    );
  }

  async update({
    responseId,
    finished,
    endingId,
    data,
    ttc,
    variables,
    language,
  }: TResponseUpdateInputWithResponseId): Promise<Result<object, ApiErrorResponse>> {
    return makeRequest(
      this.appUrl,
      `/api/v1/client/${this.environmentId}/responses/${responseId}`,
      "PUT",
      {
        finished,
        endingId,
        data,
        ttc,
        variables,
        language,
      },
      this.isDebug
    );
  }
}
