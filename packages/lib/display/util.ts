import { TDisplaysWithSurveyName } from "@formbricks/types/displays";

export const formatDisplaysDateFields = (displays: TDisplaysWithSurveyName[]): TDisplaysWithSurveyName[] => {
  return displays.map((display) => ({
    ...display,
    createdAt: new Date(display.createdAt),
    updatedAt: new Date(display.updatedAt),
  }));
};
