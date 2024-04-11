import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyQuestionType, TSurveyStatus } from "@formbricks/types/surveys";
import { TUserNotificationSettings } from "@formbricks/types/user";

export interface TInsights {
  totalCompletedResponses: number;
  totalDisplays: number;
  totalResponses: number;
  completionRate: number;
  numLiveSurvey: number;
}

export interface TSurveyResponseData {
  headline: string;
  responseValue: string | string[];
  questionType: TSurveyQuestionType;
}

export interface TNotificationDataSurvey {
  id: string;
  name: string;
  responses: TSurveyResponseData[];
  responseCount: number;
  status: string;
}

export interface TNotificationResponse {
  environmentId: string;
  currentDate: Date;
  lastWeekDate: Date;
  productName: string;
  surveys: TNotificationDataSurvey[];
  insights: TInsights;
}

// Prisma Types

type ResponseData = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  finished: boolean;
  data: TResponseData;
};

type DisplayData = {
  id: string;
};

type SurveyData = {
  id: string;
  name: string;
  questions: TSurveyQuestion[];
  status: TSurveyStatus;
  responses: ResponseData[];
  displays: DisplayData[];
};

export type EnvironmentData = {
  id: string;
  surveys: SurveyData[];
};

type UserData = {
  email: string;
  notificationSettings: TUserNotificationSettings;
};

type MembershipData = {
  user: UserData;
};

type TeamData = {
  memberships: MembershipData[];
};

export type ProductData = {
  id: string;
  name: string;
  environments: EnvironmentData[];
  team: TeamData;
};
