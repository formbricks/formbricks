import formbricks, { PersonId, SurveyId, ResponseId } from "@formbricks/js";
import { env } from "@/env.mjs";

export const formbricksEnabled =
  typeof env.NEXT_PUBLIC_FORMBRICKS_API_HOST && env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

export const createResponse = async (
  surveyId: SurveyId,
  data: { [questionId: string]: any },
  finished: boolean = false
): Promise<any> => {
  const api = formbricks.getApi();
  const personId = formbricks.getPerson()?.id as PersonId;
  return await api.createResponse({
    surveyId,
    personId,
    finished,
    data,
  });
};

export const updateResponse = async (
  responseId: ResponseId,
  data: { [questionId: string]: any },
  finished: boolean = false
): Promise<any> => {
  const api = formbricks.getApi();
  return await api.updateResponse({
    responseId,
    finished,
    data,
  });
};

export const formbricksLogout = async () => {
  return await formbricks.logout();
};
