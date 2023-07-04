export interface Insights {
  totalCompletedResponses: number;
  totalDisplays: number;
  totalResponses: number;
  completionRate: number;
  numLiveSurvey: number;
}

export interface SurveyData {
  id: string;
  name: string;
  responses: { headline: string; answer: string | null }[];
}

export interface NotificationResponse {
  environmentId: string;
  currentDate: Date;
  lastWeekDate: Date;
  productName: string;
  surveys: SurveyData[];
  insights: Insights;
}
