import { Result, ok } from "@formbricks/errors";
import { ResponseCreateRequest, ResponseUpdateRequest } from "@formbricks/types/js";
import {
  CreateResponseResponse,
  UpdateResponseResponse,
  UpdateResponseResponseFormatted,
} from "../dtos/responses";
import { NetworkError } from "../errors";
import { EnvironmentId, KeyValueData, PersonId, RequestFn, ResponseId, SurveyId } from "../types";

export interface CreateResponseOptions {
  environmentId: EnvironmentId;
  surveyId: SurveyId;
  personId?: PersonId;
  data: KeyValueData;
}

export const createResponse = async (
  request: RequestFn,
  options: CreateResponseOptions
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

export interface UpdateResponseOptions {
  environmentId: EnvironmentId;
  data: KeyValueData;
  responseId: ResponseId;
  finished?: boolean;
}

export const updateResponse = async (request: RequestFn, options: UpdateResponseOptions) => {
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
