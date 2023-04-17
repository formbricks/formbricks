import { Response, ResponseCreateRequest, ResponseUpdateRequest } from "@formbricks/types/js";
import { Result, err, ok } from "./errors";

export const createResponse = async (
  responseRequest: ResponseCreateRequest,
  config
): Promise<Result<Response, string>> => {
  const res = await fetch(`${config.apiHost}/api/v1/client/environments/${config.environmentId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseRequest),
  });
  if (!res.ok) {
    return err("Could not create response");
  }

  const response = (await res.json()) as Response;

  return ok(response);
};

export const updateResponse = async (
  responseRequest: ResponseUpdateRequest,
  responseId,
  config
): Promise<Response> => {
  const res = await fetch(
    `${config.apiHost}/api/v1/client/environments/${config.environmentId}/responses/${responseId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseRequest),
    }
  );
  if (!res.ok) {
    throw new Error("Could not update response");
  }
  return await res.json();
};
