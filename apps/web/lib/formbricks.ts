import formbricks from "@formbricks/js";
import { env } from "@/env.mjs";

export const formbricksEnabled =
  typeof env.NEXT_PUBLIC_FORMBRICKS_API_HOST && env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

export const createResponse = async (
  surveyId: string,
  data: { [questionId: string]: any },
  finished: boolean = false
): Promise<any> => {
  const api = formbricks.getApi();
  const personId = formbricks.getPerson()?.id;
  return await api.client.response.create({
    surveyId,
    personId,
    finished,
    data,
  });
};

export const updateResponse = async (
  responseId: string,
  data: { [questionId: string]: any },
  finished: boolean = false
): Promise<any> => {
  const api = formbricks.getApi();
  return await api.client.response.update({
    responseId,
    finished,
    data,
  });
};

export const formbricksLogout = async () => {
  return await formbricks.logout();
};
