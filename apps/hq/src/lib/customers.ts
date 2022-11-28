import useSWR from "swr";
import { fetcher } from "./utils";

export const useCustomers = (teamId: number) => {
  const { data, error, mutate } = useSWR(`/api/teams/${teamId}/customers`, fetcher);

  return {
    customers: data,
    isLoadingCustomers: !error && !data,
    isErrorCustomers: error,
    mutateCustomers: mutate,
  };
};

export const useCustomer = (id: string, teamId: number) => {
  const { data, error, mutate } = useSWR(`/api/teams/${teamId}/customers/${id}`, fetcher);

  return {
    customer: data,
    isLoadingCustomer: !error && !data,
    isErrorCustomer: error,
    mutateCustomer: mutate,
  };
};

export const deleteCustomer = async (id: string, teamId: number) => {
  try {
    await fetch(`/api/teams/${teamId}/customers/${id}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deleteCustomer: unable to delete customer: ${error.message}`);
  }
};
