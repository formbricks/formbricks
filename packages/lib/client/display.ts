import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";
import { FormbricksAPI } from "@formbricks/api";

export const createDisplay = async (
  displayCreateRequest: TDisplayInput,
  apiHost: string,
  environmentId: string
): Promise<TDisplay> => {
  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });
  const res = await api.client.display.markDisplayedForPerson(displayCreateRequest);
  if (!res.ok) {
    console.error(res.error);
    throw new Error("Could not create display");
  }
  return res.data;
};

export const updateDisplay = async (displayId: string, displayInput: any, apiHost: string): Promise<void> => {
  const res = await fetch(`${apiHost}/api/v1/client/displays/${displayId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayInput),
  });
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  return;
};

export const markDisplayResponded = async (
  displayId: string,
  apiHost: string,
  environmentId: string
): Promise<void> => {
  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });
  const res = await api.client.display.markResponded({ displayId });
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  return;
};
