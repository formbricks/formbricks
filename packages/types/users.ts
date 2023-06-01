export interface NotificationSettings {
  [surveyId: string]: {
    responseFinished: boolean;
    weeklySummary: boolean;
  };
}
