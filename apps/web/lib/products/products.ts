import { fetcher } from "@formbricks/lib/fetcher";
import useSWR from "swr";

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

export const createProduct = async (environmentId: string, product: { name: string }) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/product`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });

  return response.json();
};

export const deleteProduct = async (environmentId: string) => {
  const response = await fetch(`/api/v1/environments/${environmentId}/product`, {
    method: "DELETE",
  });

  return response.json();
};
