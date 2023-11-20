import { TJsLegacyState, TJsState } from "@formbricks/types/js";

export const transformLegacySurveys = (state: TJsState): TJsLegacyState => {
  const updatedState: any = { ...state };
  updatedState.surveys = updatedState.surveys.map((survey) => {
    const updatedSurvey = { ...survey };
    updatedSurvey.triggers = updatedSurvey.triggers.map((trigger) => ({ name: trigger }));
    return updatedSurvey;
  });
  return { ...updatedState, session: {} };
};
