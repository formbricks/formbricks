import { DisplayCreateRequest, JsConfig, Response } from "@formbricks/types/js";
import { NetworkError, Result, err, ok, okVoid } from "./errors";

export const createDisplay = async (
  displayCreateRequest: DisplayCreateRequest,
  config: JsConfig
): Promise<Result<Response, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/environments/${config.environmentId}/displays`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayCreateRequest),
  });

  if (!res.ok) {
    const jsonRes = await res.json();

    return err({
      code: "network_error",
      message: "Could not create display",
      status: res.status,
      url,
      responseMessage: jsonRes.message,
    });
  }

  const response = (await res.json()) as Response;

  return ok(response);
};

export const markDisplayResponded = async (
  displayId: string,
  config: JsConfig
): Promise<Result<void, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/environments/${config.environmentId}/displays/${displayId}/responded`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const jsonRes = await res.json();

    return err({
      code: "network_error",
      message: "Could not mark display as responded",
      status: res.status,
      url,
      responseMessage: jsonRes.message,
    });
  }

  return okVoid();
};
