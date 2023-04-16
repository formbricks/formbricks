import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useProduct = (environmentId: string) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/product`,
    fetcher
  );

  return {
    product: data,
    isLoadingProduct: isLoading,
    isErrorProduct: error,
    isValidatingProduct: isValidating,
    mutateProduct: mutate,
  };
};

export const createProduct = async (environmentId, product: { name: string }) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/product`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });

  return response.json();
};
