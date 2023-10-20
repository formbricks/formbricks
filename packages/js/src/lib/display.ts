import type { TDisplay, TDisplayInput } from "../../../types/displays";
import type { TJsConfig } from "../../../types/js";
import { NetworkError, Result, err, ok, okVoid } from "./errors";

export const createDisplay = async (
  displayCreateRequest: TDisplayInput,
  config: TJsConfig
): Promise<Result<TDisplay, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/displays`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayCreateRequest),
  });

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not create display",
      status: res.status,
      url,
      responseMessage: await res.text(),
    });
  }

  const jsonRes = await res.json();

  return ok(jsonRes.data as TDisplay);
};

export const markDisplayResponded = async (
  displayId: string,
  config: TJsConfig
): Promise<Result<void, NetworkError>> => {
  const url = `${config.apiHost}/api/v1/client/displays/${displayId}/responded`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not mark display as responded",
      status: res.status,
      url,
      responseMessage: await res.text(),
    });
  }

  return okVoid();
};
