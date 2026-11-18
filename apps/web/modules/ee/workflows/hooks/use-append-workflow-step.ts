"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
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
  insertWorkflowStepOnEdgeAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";

type TBranchingStepDefaults = { conditionPath?: string; caseName?: (number: number) => string };

/**
 * What a new If/else or Switch starts with: its first condition on the first Variable a step after
 * `sourceNodeId` could use, read only when one is added, from whatever samples are already cached, so
 * no canvas card subscribes to them. Nothing for other steps.
 */
const useBranchingStepDefaults = () => {
  const { t } = useTranslation();
  const store = useStore();
  const queryClient = useQueryClient();
  const authoringContext = useWorkflowEmailAuthoringContext();

  return useCallback(
    (sourceNodeId: string, stepType: TAddableWorkflowStepType): TBranchingStepDefaults => {
      if (stepType !== "if_else" && stepType !== "filter" && stepType !== "switch") return {};
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
      return {
        conditionPath: getDefaultConditionPath(groups, fallback),
        caseName: (number) => t("workspace.workflows.switch_case_name_default", { number }),
      };
    },
    [authoringContext, queryClient, store, t]
  );
};

/** Adds a step after a step (or at the start of an If/else or Switch branch) from the canvas `+` menus. */
export const useAppendWorkflowStep = () => {
  const appendStep = useSetAtom(appendWorkflowStepAfterNodeAtom);
  const getDefaults = useBranchingStepDefaults();
  return useCallback(
    (sourceNodeId: string, stepType: TAddableWorkflowStepType, branch?: string) =>
      appendStep({ sourceNodeId, stepType, branch, ...getDefaults(sourceNodeId, stepType) }),
    [appendStep, getDefaults]
  );
};

/** Inserts a step on a line, between the two steps it connects, from the line's `+` menu. */
export const useInsertWorkflowStepOnEdge = () => {
  const insertStep = useSetAtom(insertWorkflowStepOnEdgeAtom);
  const getDefaults = useBranchingStepDefaults();
  return useCallback(
    (edgeId: string, sourceNodeId: string, stepType: TAddableWorkflowStepType) =>
      insertStep({ edgeId, stepType, ...getDefaults(sourceNodeId, stepType) }),
    [insertStep, getDefaults]
  );
};
