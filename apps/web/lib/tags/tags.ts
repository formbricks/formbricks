import { fetcher } from "@formbricks/lib/fetcher";
import useSWR from "swr";

export const useTags = (environmentId: string, surveyId: string, responseId: string) => {
  const responseTags = useSWR(
    `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/tags`,
    fetcher
  );

  return responseTags;
};
