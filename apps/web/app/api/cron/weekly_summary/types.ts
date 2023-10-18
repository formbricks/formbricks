import { TResponseData } from "@formbricks/types/v1/responses";
import { TSurveyQuestion, TSurveyStatus } from "@formbricks/types/v1/surveys";
import { TUserNotificationSettings } from "@formbricks/types/v1/users";

export interface Insights {
  totalCompletedResponses: number;
  totalDisplays: number;
  totalResponses: number;
  completionRate: number;
  numLiveSurvey: number;
}

export interface SurveyResponse {
  [headline: string]: string | number | boolean | Date | string[];
}

export interface Survey {
  id: string;
  name: string;
  responses: SurveyResponse[];
  responseCount: number;
  status: string;
}

export interface NotificationResponse {
  environmentId: string;
  currentDate: Date;
  lastWeekDate: Date;
  productName: string;
  surveys: Survey[];
  insights: Insights;
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
