import type { TDisplay, TDisplayInput } from "../../../types/v1/displays";
import { getApi } from "./api";
import { NetworkError, Result, err, ok, okVoid } from "./errors";

export const createDisplay = async (
  displayCreateRequest: TDisplayInput
): Promise<Result<TDisplay, NetworkError>> => {
  const api = getApi();
  const res = await api.client.display.markDisplayedForPerson(displayCreateRequest);
  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not create display",
      status: 400,
      url: "/api/v1/client/displays",
      responseMessage: res.error.message,
    });
  }

  return ok(res.data as TDisplay);
};

export const markDisplayResponded = async (displayId: string): Promise<Result<void, NetworkError>> => {
  const api = getApi();
  const res = await api.client.display.markResponded({ displayId });
  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Could not mark display as responded",
      status: 400,
      url: `/api/v1/client/displays/${displayId}/responded`,
      responseMessage: res.error.message,
    });
  }

  return okVoid();
};
