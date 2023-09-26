import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";

export const createResponse = async (responseInput: TResponseInput, apiHost: string): Promise<TResponse> => {
  const res = await fetch(`${apiHost}/api/v1/client/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseInput),
  });
  console.log(res);
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
  console.log(responseInput);
  const res = await fetch(`${apiHost}/api/v1/client/responses/${responseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(responseInput),
  });
  console.log(res);
  if (!res.ok) {
    throw new Error("Could not update response");
  }
  const resJson = await res.json();
  return resJson.data;
};

export const updateDisplay = async (
  displayId: string,
  displayInput: any,
  apiHost: string
): Promise<TResponse> => {
  const res = await fetch(`${apiHost}/api/v1/client/displays/${displayId}/responded`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayInput),
  });
  console.log(res);
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  const resJson = await res.json();
  return resJson.data;
};
