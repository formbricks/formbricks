"use server";

import {
  getActionCountInLast24Hours,
  getActionCountInLast7Days,
  getActionCountInLastHour,
  getActiveSurveysForActionClass,
  getInactiveSurveysForActionClass,
} from "@formbricks/lib/services/actions";

export const getActionCountInLastHourAction = async (actionClassId: string) => {
  return await getActionCountInLastHour(actionClassId);
};

export const getActionCountInLast24HoursAction = async (actionClassId: string) => {
  return await getActionCountInLast24Hours(actionClassId);
};

export const getActionCountInLast7DaysAction = async (actionClassId: string) => {
  return await getActionCountInLast7Days(actionClassId);
};

export const getActiveSurveysForActionClassAction = async (actionClassId: string) => {
  return await getActiveSurveysForActionClass(actionClassId);
};

export const getInactiveSurveysForActionClassAction = async (actionClassId: string) => {
  return await getInactiveSurveysForActionClass(actionClassId);
};
