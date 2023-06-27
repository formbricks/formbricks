import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";
import type { DisplayCreateRequest, JsConfig, Response } from "../../../types/js";
import { NetworkError, Result, err, ok, okVoid } from "./errors";

export const createDisplay = async (
  displayCreateRequest: TDisplayInput,
  config: JsConfig
): Promise<Result<TDisplay, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/displays`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayCreateRequest),
  });

  const jsonRes = await res.json();

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not create display",
      status: res.status,
      url,
      responseMessage: jsonRes.message,
    });
  }

  return ok(jsonRes.data as TDisplay);
};

export const markDisplayResponded = async (
  displayId: string,
  config: JsConfig
): Promise<Result<void, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/displays/${displayId}/responded`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const jsonRes = await res.json();

  if (!res.ok) {
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
