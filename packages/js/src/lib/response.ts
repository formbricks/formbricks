import type { JsConfig, Response, ResponseCreateRequest, ResponseUpdateRequest } from "../../../types/js";
import { NetworkError, Result, err, ok } from "./errors";

export const createResponse = async (
  responseRequest: ResponseCreateRequest,
  config
): Promise<Result<Response, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/environments/${config.environmentId}/responses`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseRequest),
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

  return ok(jsonRes as Response);
};

export const updateResponse = async (
  responseRequest: ResponseUpdateRequest,
  responseId: string,
  config: JsConfig
): Promise<Result<Response, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/environments/${config.environmentId}/responses/${responseId}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseRequest),
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

  return ok(resJson as Response);
};
