"use server";

import {
  getActionCountInLast24Hours,
  getActionCountInLast7Days,
  getActionCountInLastHour,
} from "@formbricks/lib/services/actions";
import { getSurveysByActionClassId } from "@formbricks/lib/services/survey";

export const getActionCountInLastHourAction = async (actionClassId: string) => {
  return await getActionCountInLastHour(actionClassId);
};

export const getActionCountInLast24HoursAction = async (actionClassId: string) => {
  return await getActionCountInLast24Hours(actionClassId);
};

export const getActionCountInLast7DaysAction = async (actionClassId: string) => {
  return await getActionCountInLast7Days(actionClassId);
};

export const GetActiveInactiveSurveysAction = async (
  actionClassId: string
): Promise<{ activeSurveys: string[]; inactiveSurveys: string[] }> => {
  const surveys = await getSurveysByActionClassId(actionClassId);
  const response = {
    activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
    inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
  };
  return response;
};
