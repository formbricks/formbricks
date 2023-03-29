import { Response, ResponseCreateRequest, ResponseUpdateRequest } from "@formbricks/types/js";

export const createResponse = async (responseRequest: ResponseCreateRequest, config): Promise<Response> => {
  const res = await fetch(`${config.apiHost}/api/v1/client/environments/${config.environmentId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseRequest),
  });
  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create response");
  }
  return await res.json();
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
