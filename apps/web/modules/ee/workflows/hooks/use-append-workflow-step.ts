"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import {
  type TWorkflowIfElseBranch,
  type TWorkflowSampleList,
  type TWorkflowWebhookResource,
  isResponseCompletedTrigger,
} from "@formbricks/workflows";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import { workflowKeys } from "@/modules/ee/workflows/lib/query";
import { buildWorkflowVariableGroups } from "@/modules/ee/workflows/lib/variable-picker";
import { toStepVariableContext } from "@/modules/ee/workflows/lib/workflow-samples";
import {
  type TAddableWorkflowStepType,
  getDefaultConditionPath,
} from "@/modules/ee/workflows/lib/workflow-steps";
import {
  appendWorkflowStepAfterNodeAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";

/**
 * Adds a step after a step (or at the start of an If/else branch) from the canvas `+` menus. A new
 * If/else starts on the first Variable the step could use; that is read only when one is added, from
 * whatever samples are already cached, so no canvas card subscribes to them.
 */
export const useAppendWorkflowStep = () => {
  const store = useStore();
  const queryClient = useQueryClient();
  const authoringContext = useWorkflowEmailAuthoringContext();
  const appendStep = useSetAtom(appendWorkflowStepAfterNodeAtom);

  return useCallback(
    (sourceNodeId: string, stepType: TAddableWorkflowStepType, branch?: TWorkflowIfElseBranch) => {
      if (stepType !== "if_else") {
        appendStep({ sourceNodeId, stepType, branch });
        return;
      }
      const definition = store.get(workflowDefinitionAtom);
      const workflowId = store.get(workflowAtom)?.id ?? "";
      const webhook = queryClient.getQueryData<TWorkflowWebhookResource>(workflowKeys.webhook(workflowId));
      const samples = queryClient.getQueryData<TWorkflowSampleList>(workflowKeys.samples(workflowId));
      const groups = buildWorkflowVariableGroups({
        definition,
        // What the source step sees is enough for a first pick: the payload and survey answers.
        nodeId: sourceNodeId,
        sampleVariables: webhook?.sample?.variables ?? null,
        survey: resolveBoundTriggerSurvey(authoringContext, definition),
        stepContext: toStepVariableContext(samples),
      });
      const fallback = isResponseCompletedTrigger(definition?.trigger) ? "response.answer" : undefined;
      appendStep({
        sourceNodeId,
        stepType,
        branch,
        conditionPath: getDefaultConditionPath(groups, fallback),
      });
    },
    [appendStep, authoringContext, queryClient, store]
  );
};
