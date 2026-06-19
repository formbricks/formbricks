"use client";

import { Provider as JotaiProvider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { surveyChoicesAtom } from "@/modules/workflows/state/editor";
import type { TWorkflowSurveyChoice } from "@/modules/workflows/types";

interface WorkflowEditorProviderProps {
  children: ReactNode;
  surveyChoices?: TWorkflowSurveyChoice[];
}

// Seeds the survey-choices atom before the first child render so dropdowns aren't briefly
// empty after navigation. useHydrateAtoms only writes on first render.
const SurveyChoicesHydrator = ({ choices }: Readonly<{ choices: TWorkflowSurveyChoice[] }>) => {
  useHydrateAtoms([[surveyChoicesAtom, choices]]);
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
