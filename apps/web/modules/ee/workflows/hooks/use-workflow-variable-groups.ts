"use client";

import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { useWorkflowSamples, useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import {
  type TWorkflowStepVariableContext,
  type TWorkflowVariableGroup,
  buildWorkflowVariableGroups,
} from "@/modules/ee/workflows/lib/variable-picker";
import { hasSavedWebhookTrigger, toStepVariableContext } from "@/modules/ee/workflows/lib/workflow-samples";
import {
  isWorkflowReadOnlyAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";

/**
 * The Variable picker's groups for a field of `nodeId`, from the editor's live definition, the
 * Sample payload of a saved Webhook trigger, the HTTP request steps' last Test request responses, and
 * the bound survey of a Response completed trigger. Samples are only fetched for members with write
 * access (the routes serve no one else), and a failed fetch reads as "no sample yet".
 */
export const useWorkflowVariableGroups = (
  nodeId: string,
  stepContext?: TWorkflowStepVariableContext
): TWorkflowVariableGroup[] => {
  const definition = useAtomValue(workflowDefinitionAtom);
  const workflow = useAtomValue(workflowAtom);
  const isReadOnly = useAtomValue(isWorkflowReadOnlyAtom);
  const authoringContext = useWorkflowEmailAuthoringContext();
  const workflowId = workflow?.id ?? null;

  // The Secret URL (and its sample) exists once the Webhook trigger is saved, not while only drafted.
  const webhook = useWorkflowWebhook({
    workflowId,
    enabled: hasSavedWebhookTrigger(workflow) && !isReadOnly,
  });
  const hasHttpRequestStep = Boolean(
    definition?.nodes.some((node) => node.type === "action" && node.actionType === "http_request")
  );
  const samples = useWorkflowSamples({ workflowId, enabled: hasHttpRequestStep && !isReadOnly });
  const sampleVariables = webhook.data?.sample?.variables ?? null;
  const survey = resolveBoundTriggerSurvey(authoringContext, definition);
  const resolvedStepContext = stepContext ?? toStepVariableContext(samples.data);

  // The definition changes on every keystroke in any field, the groups rarely. Keyed on their content,
  // the same array comes back while nothing in them changed, which spares the kit Editor's recall
  // plugin a re-registration (and an editor update) per keystroke in the very body it serves.
  const groupsKey = JSON.stringify(
    buildWorkflowVariableGroups({
      definition,
      nodeId,
      sampleVariables,
      survey,
      stepContext: resolvedStepContext,
    })
  );
  return useMemo(() => JSON.parse(groupsKey) as TWorkflowVariableGroup[], [groupsKey]);
};
