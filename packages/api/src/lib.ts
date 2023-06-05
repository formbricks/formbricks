import { Result, err, ok, wrapThrows } from "@formbricks/errors";
import { CreateResponseResponse, UpdateResponseResponseFormatted } from "./dtos/responses";
import { NetworkError } from "./errors";

import {
  CreateResponseOptions,
  UpdateResponseOptions,
  createResponse,
  updateResponse,
} from "./endpoints/response";
import { EnvironmentId, RequestFn } from "./types";

export interface FormbricksAPIOptions {
  apiHost?: string;
  environmentId: EnvironmentId;
}

export class FormbricksAPI {
  private readonly baseUrl: string;
  private readonly environmentId: EnvironmentId;

  constructor(options: FormbricksAPIOptions) {
    this.baseUrl = options.apiHost || "https://app.formbricks.com";
    this.environmentId = options.environmentId;
    this.request = this.request.bind(this);
  }

  async createResponse(
    options: Omit<CreateResponseOptions, "environmentId">
  ): Promise<Result<CreateResponseResponse, NetworkError>> {
    return this.runWithEnvironmentId(createResponse, options);
  }

  async updateResponse(
    options: Omit<UpdateResponseOptions, "environmentId">
  ): Promise<Result<UpdateResponseResponseFormatted, NetworkError>> {
    return this.runWithEnvironmentId(updateResponse, options);
  }

  /*
    This was added to reduce code duplication

    It checks that the function passed has the environmentId in the Options type
    and automatically adds it to the options
  */
  private runWithEnvironmentId<T, E, Options extends { environmentId: EnvironmentId }>(
    fn: (request: RequestFn, options: Options) => Promise<Result<T, E>>,
    options: Omit<Options, "environmentId">
  ): Promise<Result<T, E>> {
    const newOptions = { environmentId: this.environmentId, ...options } as Options;

    return fn(this.request, newOptions);
  }

  private async request<T = any, E = any, Data = any>(
    path: string,
    data: Data,
    options?: RequestInit
  ): Promise<Result<T, E | NetworkError | Error>> {
    const url = new URL(path, this.baseUrl);
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    const body = JSON.stringify(data);

    const res = wrapThrows(fetch)(url, { headers, body, ...options });

    if (res.ok === false) return err(res.error);

    const response = await res.data;
    const resJson = await response.json();

    if (!response.ok) {
      return err({
        code: "network_error",
        message: response.statusText,
        status: response.status,
        url,
      });
    }

    return ok(resJson as T);
  }
}
