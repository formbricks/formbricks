import formbricks, { PersonId, SurveyId, ResponseId } from "@formbricks/js";

export const formbricksEnabled =
  typeof process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST && process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

export const createResponse = async (
  surveyId: SurveyId,
  data: { [questionId: string]: any },
  finished: boolean = false
) => {
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
) => {
  const api = formbricks.getApi();
  return await api.updateResponse({
    responseId,
    finished,
    data,
  });
};
