import { DisplayCreateRequest, Response } from "@formbricks/types/js";
import { Result, err, ok } from "./errors";

export const createDisplay = async (
  displayCreateRequest: DisplayCreateRequest,
  config
): Promise<Result<Response, string>> => {
  const res = await fetch(`${config.apiHost}/api/v1/client/environments/${config.environmentId}/displays`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayCreateRequest),
  });
  if (!res.ok) {
    return err("Could not create display");
  }

  const response = (await res.json()) as Response;

  return ok(response);
};

export const markDisplayResponded = async (displayId, config): Promise<Result<void, string>> => {
  const res = await fetch(
    `${config.apiHost}/api/v1/client/environments/${config.environmentId}/displays/${displayId}/responded`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) {
    return err("Could not update display");
  }
  return;
};
