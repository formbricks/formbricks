"use server";

import { getSurveysByAttributeClassId } from "@formbricks/lib/survey/service";

export const GetActiveInactiveSurveysAction = async (
  attributeClassId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const surveys = await getSurveysByAttributeClassId(attributeClassId);
  const response = {
    activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
    inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
  };
  return response;
};
