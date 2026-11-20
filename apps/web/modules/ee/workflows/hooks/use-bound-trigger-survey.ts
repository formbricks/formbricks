"use client";

import { useAtomValue } from "jotai";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import { workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";

/** The survey the Response completed trigger is bound to, once loaded; null for any other trigger. */
export const useBoundTriggerSurvey = (): TSurvey | null => {
  const definition = useAtomValue(workflowDefinitionAtom);
  const authoringContext = useWorkflowEmailAuthoringContext();
  return resolveBoundTriggerSurvey(authoringContext, definition);
};
