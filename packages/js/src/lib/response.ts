import { getApi } from "./api";
import type { TResponse, TResponseInput } from "../../../types/v1/responses";
import { NetworkError, Result, err, ok } from "./errors";

export const createResponse = async (
  responseInput: TResponseInput
): Promise<Result<TResponse, NetworkError>> => {
  const api = getApi();
  const res = await api.client.response.create(responseInput);
  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not create response",
      status: 400,
      url: "/api/v1/client/responses",
      responseMessage: res.error.message,
    });
  }

  return ok(res.data as TResponse);
};

export const updateResponse = async (
  responseInput: TResponseInput,
  responseId: string
): Promise<Result<TResponse, NetworkError>> => {
  const api = getApi();
  const res = await api.client.response.update({ ...responseInput, responseId });
  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not update response",
      status: 400,
      url: `/api/v1/client/responses/${responseId}`,
      responseMessage: res.error.message,
    });
  }

  return ok(res.data as TResponse);
};
