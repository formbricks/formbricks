import useSWR from "swr";
import { fetcher } from "./utils";

export const useNoCodeForm = (formId) => {
  const { data, error, mutate } = useSWR(
    `/api/forms/${formId}/nocodeform`,
    fetcher
  );

  return {
    noCodeForm: data,
    isLoadingNoCodeForm: !error && !data,
    isErrorNoCodeForm: error,
    mutateNoCodeForm: mutate,
  };
};

export const createNoCodeForm = async (formId) => {
  try {
    const res = await fetch(`/api/forms/${formId}/nocodeform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(
      `createNoCodeForm: unable to create noCodeForm: ${error.message}`
    );
  }
};
