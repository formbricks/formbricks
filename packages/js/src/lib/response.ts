import type { JsConfig, Response } from "../../../types/js";
import type { TResponse, TResponseInput } from "../../../types/v1/responses";
import { NetworkError, Result, err, ok } from "./errors";

export const createResponse = async (
  responseInput: TResponseInput,
  config
): Promise<Result<TResponse, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/responses`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseInput),
  });

  const jsonRes = await res.json();

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not create response",
      status: res.status,
      url,
      responseMessage: jsonRes.message,
    });
  }

  return ok(jsonRes.data as TResponse);
};

export const updateResponse = async (
  responseInput: TResponseInput,
  responseId: string,
  config: JsConfig
): Promise<Result<TResponse, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/responses/${responseId}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseInput),
  });

  const resJson = await res.json();

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not update response",
      status: res.status,
      url,
      responseMessage: resJson.message,
    });
  }

  return ok(resJson.data as TResponse);
};
