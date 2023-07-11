export interface NotificationSettings {
  alert: {
    [surveyId: string]: boolean;
  };
  weeklySummary: {
    [productId: string]: boolean;
  };
}
