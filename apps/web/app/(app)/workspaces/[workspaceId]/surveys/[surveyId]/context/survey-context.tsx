"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { newerSurvey } from "./newer-survey";

export interface SurveyContextType {
  survey: TSurvey;
  /**
   * Hold a survey a save just answered with. Saves go through `/api/internal/surveys/{id}`, which doesn't
   * re-render the page as the server action it replaced did, so without this the next save on the page
   * (another share tab, the status dropdown) would be built from the copy rendered before the first.
   */
  replaceSurvey: (survey: TSurvey) => void;
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
  readonly survey: TSurvey;
  readonly children: React.ReactNode;
}

export const SurveyContextWrapper = ({ survey, children }: SurveyContextWrapperProps) => {
  const [current, setCurrent] = useState(survey);
  const [rendered, setRendered] = useState(survey);

  // A new server render (a refresh, a navigation) is adopted unless it is older than a save already held.
  if (survey !== rendered) {
    setRendered(survey);
    setCurrent((held) => newerSurvey(held, survey));
  }

  const replaceSurvey = useCallback((saved: TSurvey) => {
    setCurrent((held) => newerSurvey(held, saved));
  }, []);

  const surveyContextValue = useMemo(() => ({ survey: current, replaceSurvey }), [current, replaceSurvey]);

  return <SurveyContext.Provider value={surveyContextValue}>{children}</SurveyContext.Provider>;
};
