import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useApiKeys = (environmentId: string) => {
  const { data, error, mutate } = useSWR(`/api/v1/environments/${environmentId}/api-keys`, fetcher);

  return {
    apiKeys: data,
    isLoadingApiKeys: !error && !data,
    isErrorApiKeys: error,
    mutateApiKeys: mutate,
  };
};

export const createApiKey = async (environmentId: string, apiKey = {}) => {
  try {
    const res = await fetch(`/api/v1/environments/${environmentId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiKey),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createApiKey: unable to create api-key: ${error.message}`);
  }
};

export const deleteApiKey = async (environmentId: string, apiKey) => {
  try {
    const res = await fetch(`/api/v1/environments/${environmentId}/api-keys/${apiKey.id}`, {
      method: "DELETE",
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`deleteApiKey: unable to delete api-key: ${error.message}`);
  }
};
