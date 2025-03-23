"use client";

export const copySurveyLink = (surveyUrl: string, singleUseId?: string): string => {
  return singleUseId ? `${surveyUrl}?suId=${singleUseId}` : surveyUrl;
};
