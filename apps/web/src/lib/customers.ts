import useSWR from "swr";
import { fetcher } from "./utils";

export const useCustomers = (organisationId: string) => {
  const { data, error, mutate } = useSWR(`/api/organisations/${organisationId}/customers`, fetcher);

  return {
    customers: data,
    isLoadingCustomers: !error && !data,
    isErrorCustomers: error,
    mutateCustomers: mutate,
  };
};

export const useCustomer = (organisationId: string, customerId: string) => {
  const { data, error, mutate } = useSWR(
    `/api/organisations/${organisationId}/customers/${customerId}`,
    fetcher
  );

  return {
    customer: data,
    isLoadingCustomer: !error && !data,
    isErrorCustomer: error,
    mutateCustomer: mutate,
  };
};

export const deleteCustomer = async (email: string, organisationId: string) => {
  try {
    await fetch(`/api/organisations/${organisationId}/customers/${email}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deleteCustomer: unable to delete customer: ${error.message}`);
  }
};
