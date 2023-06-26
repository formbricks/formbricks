import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";
import type { AttributeClass } from "@prisma/client";

export const useAttributeClasses = (environmentId) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/attribute-classes`,
    fetcher
  );

  return {
    attributeClasses: data,
    isLoadingAttributeClasses: isLoading,
    isErrorAttributeClasses: error,
    isValidatingAttributeClasses: isValidating,
    mutateAttributeClasses: mutate,
  };
};

type AttributeClassWithSurvey = AttributeClass & {
  activeSurveys: string[];
  inactiveSurveys: string[];
};

export const useAttributeClass = (environmentId: string, attributeClassId: string) => {
  const { data, isLoading, error, mutate, isValidating } = useSWR(
    `/api/v1/environments/${environmentId}/attribute-classes/${attributeClassId}`,
    fetcher
  );

  return {
    attributeClass: data as AttributeClassWithSurvey,
    isLoadingAttributeClass: isLoading,
    isErrorAttributeClass: error,
    isValidatingAttributeClass: isValidating,
    mutateAttributeClass: mutate,
  };
};
