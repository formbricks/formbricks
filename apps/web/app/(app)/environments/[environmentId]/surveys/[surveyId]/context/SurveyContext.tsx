"use client";

import { createContext, useContext, useMemo } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

export interface SurveyContextType {
  survey: TSurvey;
}

const SurveyContext = createContext<SurveyContextType | null>(null);
SurveyContext.displayName = "SurveyContext";

export const useSurvey = () => {
  const context = useContext(SurveyContext);
  if (!context) {
    throw new Error("useSurvey must be used within a SurveyContextWrapper");
  }
  return context;
};

// Client wrapper component to be used in server components
interface SurveyContextWrapperProps {
  survey: TSurvey;
  children: React.ReactNode;
}

export const SurveyContextWrapper = ({ survey, children }: SurveyContextWrapperProps) => {
  const surveyContextValue = useMemo(
    () => ({
      survey,
    }),
    [survey]
  );

  return <SurveyContext.Provider value={surveyContextValue}>{children}</SurveyContext.Provider>;
};
