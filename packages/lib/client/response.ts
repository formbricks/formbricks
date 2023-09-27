import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";

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
  const resJson = await res.json();
  return resJson.data;
};

export const updateResponse = async (
  responseInput: TResponseUpdateInput,
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
  const resJson = await res.json();
  return resJson.data;
};
