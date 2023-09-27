import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";

export const createDisplay = async (
  displayCreateRequest: TDisplayInput,
  apiHost: string
): Promise<TDisplay> => {
  const res = await fetch(`${apiHost}/api/v1/client/displays`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayCreateRequest),
  });
  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create display");
  }
  const resJson = await res.json();
  return resJson.data;
};

export const updateDisplay = async (displayId: string, displayInput: any, apiHost: string): Promise<void> => {
  const res = await fetch(`${apiHost}/api/v1/client/displays/${displayId}/responded`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayInput),
  });
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  return;
};

export const markDisplayResponded = async (displayId: string, apiHost: string): Promise<void> => {
  const res = await fetch(`${apiHost}/api/v1/client/displays/${displayId}/responded`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  return;
};
