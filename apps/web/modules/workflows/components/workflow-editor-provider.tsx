"use client";

import { Provider as JotaiProvider, useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { setSurveyChoicesAtom } from "@/modules/workflows/state/editor";
import type { TWorkflowSurveyChoice } from "@/modules/workflows/types";

interface WorkflowEditorProviderProps {
  children: ReactNode;
  surveyChoices?: TWorkflowSurveyChoice[];
}

const SurveyChoicesHydrator = ({ choices }: Readonly<{ choices: TWorkflowSurveyChoice[] }>) => {
  const setSurveyChoices = useSetAtom(setSurveyChoicesAtom);
  useEffect(() => {
    setSurveyChoices(choices);
  }, [choices, setSurveyChoices]);
  return null;
};

export const WorkflowEditorProvider = ({
  children,
  surveyChoices,
}: Readonly<WorkflowEditorProviderProps>) => (
  <JotaiProvider>
    {surveyChoices ? <SurveyChoicesHydrator choices={surveyChoices} /> : null}
    {children}
  </JotaiProvider>
);
