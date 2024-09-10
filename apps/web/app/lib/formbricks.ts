import { FormbricksAPI } from "@formbricks/api";
import formbricks from "@formbricks/js/app";
import { env } from "@formbricks/lib/env";

export const formbricksEnabled =
  typeof env.NEXT_PUBLIC_FORMBRICKS_API_HOST && env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;
const ttc = { onboarding: 0 };

const getFormbricksApi = () => {
  const environmentId = env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;
  const apiHost = env.NEXT_PUBLIC_FORMBRICKS_API_HOST;

  if (typeof environmentId !== "string" || typeof apiHost !== "string") {
    throw new Error("Formbricks environment ID or API host is not defined");
  }

  return new FormbricksAPI({
    environmentId,
    apiHost,
  });
};

export const createResponse = async (
  surveyId: string,
  userId: string,
  data: { [questionId: string]: any },
  finished: boolean = false,
  failed: boolean = false
): Promise<any> => {
  const api = getFormbricksApi();
  return await api.client.response.create({
    surveyId,
    userId,
    finished,
    failed,
    data,
    ttc,
  });
};

export const updateResponse = async (
  responseId: string,
  data: { [questionId: string]: any },
  finished: boolean = false,
  failed: boolean
): Promise<any> => {
  const api = getFormbricksApi();
  return await api.client.response.update({
    responseId,
    finished,
    failed,
    data,
    ttc,
  });
};

export const formbricksLogout = async () => {
  localStorage.clear();
  return await formbricks.logout();
};
