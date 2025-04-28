import { TSurvey } from "@formbricks/types/surveys/types";

export type TSurveyCreator = {
  name: string | null;
  imageUrl: string | null;
};

export type TExtendedSurvey = TSurvey & {
  responseCount?: number;
  creator?: TSurveyCreator;
};
