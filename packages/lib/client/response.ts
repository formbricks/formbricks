import { TResponseInput, TResponse } from "@formbricks/types/v1/responses";

export const createResponse = async (responseInput: TResponseInput, apiHost: string): Promise<TResponse> => {
  const res = await fetch(`${apiHost}/api/v1/client/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseInput),
  });
  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create response");
  }
  return await res.json();
};

export const updateResponse = async (
  responseInput: TResponseInput,
  responseId: string,
  apiHost: string
): Promise<TResponse> => {
  const res = await fetch(`${apiHost}/api/v1/client/responses/${responseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseInput),
  });
  if (!res.ok) {
    throw new Error("Could not update response");
  }
  return await res.json();
};
