import useSWR from "swr";
import { fetcher } from "./utils";

export const useCustomers = (workspaceId: string) => {
  const { data, error, mutate } = useSWR(`/api/workspaces/${workspaceId}/customers`, fetcher);

  return {
    customers: data,
    isLoadingCustomers: !error && !data,
    isErrorCustomers: error,
    mutateCustomers: mutate,
  };
};

export const useCustomer = (workspaceId: string, customerId: string) => {
  const { data, error, mutate } = useSWR(`/api/workspaces/${workspaceId}/customers/${customerId}`, fetcher);

  return {
    customer: data,
    isLoadingCustomer: !error && !data,
    isErrorCustomer: error,
    mutateCustomer: mutate,
  };
};

export const deleteCustomer = async (id: string, workspaceId: string) => {
  try {
    await fetch(`/api/workspaces/${workspaceId}/customers/${id}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deleteCustomer: unable to delete customer: ${error.message}`);
  }
};
