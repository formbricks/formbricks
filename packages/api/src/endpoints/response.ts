import { Result, ok } from "@formbricks/errors";
import { ResponseCreateRequest, ResponseUpdateRequest } from "@formbricks/types/js";
import {
  CreateResponseResponse,
  UpdateResponseResponse,
  UpdateResponseResponseFormatted,
} from "../dtos/responses";
import { NetworkError } from "../errors";
import { IEnvironmentId, KeyValueData, PersonId, RequestFn, ResponseId, SurveyId } from "../types";

export interface ICreateResponseOptions extends IEnvironmentId {
  surveyId: SurveyId;
  personId: PersonId;
  data: KeyValueData;
}

export const createResponse = async (
  request: RequestFn,
  options: ICreateResponseOptions
): Promise<Result<CreateResponseResponse, NetworkError>> => {
  const result = await request<CreateResponseResponse, any, ResponseCreateRequest>(
    `/api/v1/client/environments/${options.environmentId}/responses`,
    {
      surveyId: options.surveyId,
      personId: options.personId,
      response: {
        data: options.data,
        finished: false,
      },
    },
    { method: "POST" }
  );

  return result;
};

export interface IUpdateResponseOptions extends IEnvironmentId {
  data: KeyValueData;
  responseId: ResponseId;
  finished?: boolean;
}

export const updateResponse = async (request: RequestFn, options: IUpdateResponseOptions) => {
  const result = await request<UpdateResponseResponse, any, ResponseUpdateRequest>(
    `/api/v1/client/environments/${options.environmentId}/responses/${options.responseId}`,
    {
      response: {
        data: options.data,
        finished: options.finished || false,
      },
    },
    {
      method: "PUT",
    }
  );

  if (result.ok === false) return result;

  // convert timestamps to Dates
  const newResponse: UpdateResponseResponseFormatted = {
    ...result.data,
    createdAt: new Date(result.data.createdAt),
    updatedAt: new Date(result.data.updatedAt),
  };

  return ok(newResponse);
};
