import { Result, err, ok, wrapThrows } from "@formbricks/errors";
import { ResponseCreateRequest, ResponseUpdateRequest } from "@formbricks/types/js";
import {
  StartResponseResponse,
  UpdateResponseResponse,
  UpdateResponseResponseFormatted,
} from "./dtos/responses";
import { NetworkError } from "./errors";

export class FormbricksAPI {
  private readonly baseUrl: string;
  private readonly environmentId: string;

  // DO NOT declare the field in the constructor, it complicates tree-shaking
  constructor(apiHost: string, environmentId: string) {
    this.baseUrl = apiHost;
    this.environmentId = environmentId;
  }

  async startResponse(
    surveyId: string,
    personId: string,
    data: { [key: string]: any }
  ): Promise<Result<StartResponseResponse, NetworkError>> {
    const result = await this.request<StartResponseResponse, any, ResponseCreateRequest>(
      `/api/v1/client/environments/${this.environmentId}/responses`,
      {
        surveyId,
        personId,
        response: {
          data,
          finished: false,
        },
      },
      { method: "POST" }
    );

    return result;
  }

  async updateResponse(
    responseId: string,
    data: { [key: string]: any },
    finished: boolean = false
  ): Promise<Result<UpdateResponseResponseFormatted, NetworkError>> {
    const result = await this.request<UpdateResponseResponse, any, ResponseUpdateRequest>(
      `/api/v1/client/environments/${this.environmentId}/responses/${responseId}`,
      {
        response: {
          data,
          finished,
        },
      },
      {
        method: "PUT",
      }
    );

    if (result.ok === false) return result;

    const newResponse: UpdateResponseResponseFormatted = {
      ...result.value,
      createdAt: new Date(result.value.createdAt),
      updatedAt: new Date(result.value.updatedAt),
    };

    return ok(newResponse);
  }

  private async request<T = any, E = any, Data = any>(
    path: string,
    data: Data,
    options?: RequestInit
  ): Promise<Result<T, E | NetworkError | Error>> {
    const url = `${this.baseUrl}${path}`;

    const res = wrapThrows(() =>
      fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        ...options,
      })
    )();

    if (res.ok === false) return err(res.error);

    const response = await res.value;
    const resJson = await response.json();

    if (!response.ok)
      return err({
        code: "network_error",
        message: response.statusText,
        status: response.status,
        url,
      });

    return ok(resJson as T);
  }
}
