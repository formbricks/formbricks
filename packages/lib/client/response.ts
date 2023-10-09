import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";
import { FormbricksAPI } from "@formbricks/api";

export const createResponse = async (
  responseInput: TResponseInput,
  apiHost: string,
  environmentId: string
): Promise<TResponse> => {
  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });
  const res = await api.client.response.create(responseInput);
  if (!res.ok) {
    console.error(res.error);
    throw new Error("Could not create response");
  }
  return res.data;
};

export const updateResponse = async (
  responseInput: TResponseUpdateInput,
  responseId: string,
  apiHost: string,
  environmentId: string
): Promise<TResponse> => {
  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });
  const res = await api.client.response.update({ ...responseInput, responseId });
  if (!res.ok) {
    throw new Error("Could not update response");
  }
  return res.data;
};
