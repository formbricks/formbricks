"use server";

import {
  getActiveSurveysForAttributeClass,
  getInactiveSurveysForAttributeClass,
} from "@formbricks/lib/services/attributeClass";

export const getActiveSurveysForAttributeClassAction = async (attributeClassId: string) => {
  const activeSurveys = await getActiveSurveysForAttributeClass(attributeClassId);
  return activeSurveys;
};

export const getInactiveSurveysForAttributeClassAction = async (attributeClassId: string) => {
  const inactiveSurveys = await getInactiveSurveysForAttributeClass(attributeClassId);
  return inactiveSurveys;
};
