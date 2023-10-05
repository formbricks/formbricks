import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";
import { FormbricksAPI } from "@formbricks/api";

export const createDisplay = async (
  displayCreateRequest: TDisplayInput,
  apiHost: string
): Promise<TDisplay> => {
  const api = new FormbricksAPI({
    apiHost,
    environmentId: "",
  });
  const res = await api.client.display.markDisplayedForPerson(displayCreateRequest);
  if (!res.ok) {
    console.error(res.error);
    throw new Error("Could not create display");
  }
  return res.data;
};

export const markDisplayResponded = async (displayId: string, apiHost: string): Promise<void> => {
  const api = new FormbricksAPI({
    apiHost,
    environmentId: "",
  });
  const res = await api.client.display.markResponded({ displayId });
  if (!res.ok) {
    throw new Error("Could not update display");
  }
  return;
};
